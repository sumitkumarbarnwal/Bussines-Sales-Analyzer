"""
AI-Powered Column Detection & Data Correction using OpenAI GPT
"""
import os
import json
import pandas as pd
from openai import OpenAI

# Lazy initialize OpenAI client (only when needed)
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
client = None

def get_client():
    """Get or create OpenAI client lazily"""
    global client
    if client is None and OPENAI_API_KEY:
        try:
            client = OpenAI(api_key=OPENAI_API_KEY)
        except Exception as e:
            print(f"Warning: Failed to initialize OpenAI client: {e}")
    return client

# Standard business column mapping
EXPECTED_COLUMNS = {
    'date': ['date', 'transaction_date', 'order_date', 'sale_date', 'created_at', 'transaction_date', 'date_of_sale'],
    'product': ['product', 'product_name', 'item', 'item_name', 'product_id', 'sku'],
    'category': ['category', 'product_category', 'type', 'item_category', 'department'],
    'quantity': ['quantity', 'qty', 'units', 'units_sold', 'amount', 'count'],
    'unit_price': ['unit_price', 'price', 'selling_price', 'unit_cost', 'rate', 'price_per_unit'],
    'cost_price': ['cost_price', 'cost', 'unit_cost', 'cogs', 'manufacturing_cost'],
    'revenue': ['revenue', 'total', 'sales', 'total_sales', 'amount', 'total_amount'],
    'profit': ['profit', 'net_profit', 'net', 'earnings'],
    'customer': ['customer', 'customer_name', 'client', 'buyer', 'seller'],
    'region': ['region', 'location', 'state', 'city', 'area', 'territory']
}


def detect_column_type_local(col_name, sample_values):
    """
    Smart local column detection without API (pattern matching fallback).
    """
    col_lower = col_name.lower().strip()
    
    # Check date patterns
    if any(x in col_lower for x in ['date', 'time', 'created', 'transaction', 'order', 'sale']):
        return 'date'
    
    # Check quantity patterns
    if any(x in col_lower for x in ['qty', 'quantity', 'units', 'count', 'amount', 'sold']):
        return 'numeric'
    
    # Check price patterns
    if any(x in col_lower for x in ['price', 'cost', 'rate', 'revenue', 'profit', 'total', 'sales']):
        return 'numeric'
    
    # Check text patterns
    if any(x in col_lower for x in ['product', 'item', 'name', 'category', 'customer', 'client', 'region', 'location', 'state', 'city']):
        return 'text'
    
    # Detect based on actual data
    try:
        numeric_count = 0
        for val in sample_values[:10]:
            if val is None or str(val).strip() == '':
                continue
            try:
                float(val)
                numeric_count += 1
            except:
                pass
        
        if numeric_count > len([v for v in sample_values[:10] if v is not None and str(v).strip()]) * 0.5:
            return 'numeric'
    except:
        pass
    
    return 'text'


def smart_column_mapping(df):
    """
    Intelligently map columns using pattern matching (local fallback).
    """
    column_mappings = {}
    column_types = {}
    business_fields = {}
    corrections = []
    
    for col in df.columns:
        col_lower = col.lower().strip()
        found = False
        
        # Try to match with expected columns
        for business_field, aliases in EXPECTED_COLUMNS.items():
            for alias in aliases:
                if alias.lower() == col_lower or col_lower.startswith(alias.lower()):
                    column_mappings[col] = business_field
                    col_type = detect_column_type_local(col, df[col].dropna().head(10).tolist())
                    column_types[col] = col_type
                    
                    if business_field not in business_fields:
                        business_fields[business_field] = {'original_column': col, 'standardized_name': business_field}
                    
                    if col != business_field:
                        corrections.append({
                            'column': col,
                            'issue': f"Column name not standardized",
                            'suggestion': f"Rename '{col}' to '{business_field}'"
                        })
                    
                    found = True
                    break
            
            if found:
                break
        
        if not found:
            # Unknown column - just detect type
            col_type = detect_column_type_local(col, df[col].dropna().head(10).tolist())
            column_types[col] = col_type
            column_mappings[col] = col
    
    # Find missing business columns
    missing_columns = []
    for business_field in ['transaction_date', 'product_name', 'quantity', 'unit_price', 'cost_price']:
        if business_field not in business_fields:
            missing_columns.append(business_field)
    
    return {
        'column_mappings': column_mappings,
        'column_types': column_types,
        'business_fields': business_fields,
        'corrections': corrections,
        'missing_columns': missing_columns,
        'method': 'local_pattern_matching',
        'quality_score': 0.85,
        'summary': f'Mapped {len(column_mappings)} columns using pattern matching'
    }



def analyze_columns_with_ai(df):
    """
    Use OpenAI GPT to intelligently detect and map column names.
    Falls back to smart pattern matching if API fails.
    
    Args:
        df: pandas DataFrame with raw column names
        
    Returns:
        dict with column mappings, suggested corrections, and data quality insights
    """
    
    original_columns = df.columns.tolist()
    sample_data = df.head(3).to_dict('records')
    
    # Build analysis prompt
    prompt = f"""
You are an expert data analyst. Analyze these spreadsheet columns and provide intelligent detection.

Original Columns: {original_columns}
Sample Data (first 3 rows): {json.dumps(sample_data, default=str)}

For each column, determine:
1. The actual business field (date, product, quantity, price, cost, revenue, profit, etc.)
2. The best standardized name
3. Suggested data type (date, numeric, text, category)
4. Any data quality issues

Required business columns for sales data:
- transaction_date: When the transaction occurred
- product_name: Name of product sold
- category: Product category
- quantity: How many units sold
- unit_price: Price per unit
- cost_price: Cost per unit  
- revenue: Total sales amount (qty * unit_price)
- profit: Profit (revenue - quantity*cost_price)

Respond with ONLY valid JSON (no markdown, no extra text):
{{
  "column_mappings": {{
    "original_name": "standardized_name"
  }},
  "column_types": {{
    "original_name": "detected_type"
  }},
  "business_fields": {{
    "field_type": {{"original_column": "...", "standardized_name": "..."}}
  }},
  "corrections": [
    {{"column": "...", "issue": "...", "suggestion": "..."}}
  ],
  "missing_columns": ["list of missing business fields"],
  "quality_score": 0.0,
  "summary": "brief analysis"
}}
"""
    
    try:
        openai_client = get_client()
        if not openai_client:
            print("OpenAI API key not configured, using fallback...")
            return smart_column_mapping(df)
        
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0,
            max_tokens=1500
        )
        
        response_text = response.choices[0].message.content.strip()
        
        # Parse JSON response
        try:
            analysis = json.loads(response_text)
            analysis['method'] = 'openai_gpt4'
            return analysis
        except json.JSONDecodeError:
            # Try to extract JSON from response
            import re
            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if json_match:
                analysis = json.loads(json_match.group())
                analysis['method'] = 'openai_gpt4'
                return analysis
            else:
                print("Could not parse AI response as JSON, using fallback...")
                return smart_column_mapping(df)
        
    except Exception as e:
        print(f"OpenAI API Error: {e}")
        print("Falling back to local pattern matching...")
        return smart_column_mapping(df)


def auto_correct_dataframe(df, ai_analysis=None):
    """
    Automatically correct and standardize dataframe based on AI analysis.
    
    Args:
        df: Original DataFrame
        ai_analysis: Result from analyze_columns_with_ai()
        
    Returns:
        Corrected DataFrame with standardized columns
    """
    
    if ai_analysis is None:
        ai_analysis = analyze_columns_with_ai(df)
    
    if not ai_analysis:
        return df.copy()
    
    df_corrected = df.copy()
    
    # Rename columns based on AI mappings
    column_mappings = ai_analysis.get('column_mappings', {})
    rename_map = {}
    for orig, standardized in column_mappings.items():
        if orig in df_corrected.columns:
            rename_map[orig] = standardized
    
    df_corrected = df_corrected.rename(columns=rename_map)
    
    # Fix data types
    column_types = ai_analysis.get('column_types', {})
    for orig, dtype in column_types.items():
        standard_name = column_mappings.get(orig, orig)
        if standard_name not in df_corrected.columns:
            continue
            
        try:
            if dtype == 'date':
                df_corrected[standard_name] = pd.to_datetime(df_corrected[standard_name], errors='coerce')
            elif dtype == 'numeric':
                df_corrected[standard_name] = pd.to_numeric(df_corrected[standard_name], errors='coerce')
            elif dtype == 'text':
                df_corrected[standard_name] = df_corrected[standard_name].astype(str)
        except Exception as e:
            print(f"Failed to convert {standard_name} to {dtype}: {e}")
    
    # Calculate derived columns if missing
    if 'revenue' not in df_corrected.columns and 'quantity' in df_corrected.columns and 'unit_price' in df_corrected.columns:
        df_corrected['revenue'] = df_corrected['quantity'] * df_corrected['unit_price']
    
    if 'profit' not in df_corrected.columns and 'revenue' in df_corrected.columns and 'quantity' in df_corrected.columns and 'cost_price' in df_corrected.columns:
        df_corrected['profit'] = df_corrected['revenue'] - (df_corrected['quantity'] * df_corrected['cost_price'])
    
    return df_corrected


def get_column_suggestions(df):
    """
    Get AI suggestions for column alignment without modifying data.
    
    Returns:
        dict with suggestions, corrections, and confidence scores
    """
    analysis = analyze_columns_with_ai(df)
    
    if not analysis:
        return {
            'status': 'error',
            'message': 'AI analysis failed',
            'fallback': 'Using standard detection'
        }
    
    return {
        'status': 'success',
        'analysis': analysis,
        'current_columns': df.columns.tolist(),
        'row_count': len(df),
        'memory_mb': round(df.memory_usage(deep=True).sum() / 1024**2, 2)
    }
