"""
Flask Application – Sales & Business Analyzer
"""
import os, io, json, secrets, math
from datetime import datetime
from functools import wraps

import numpy as np
import pandas as pd
from flask import (
    Flask, render_template, request, jsonify, session, redirect, url_for, send_file
)
from flask.json.provider import DefaultJSONProvider
from flask_cors import CORS

import database as db
import ml_models as ml
import ai_analyzer

# Optional PDF
try:
    from reportlab.lib.pagesizes import letter
    from reportlab.lib import colors
    from reportlab.lib.units import inch
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    PDF_OK = True
except ImportError:
    PDF_OK = False


# ─── Custom JSON Provider (NaN/Inf → null) ───

class SafeJSONProvider(DefaultJSONProvider):
    """Replace NaN and Infinity with None so JSON is valid."""

    def default(self, o):
        if isinstance(o, float) and (math.isnan(o) or math.isinf(o)):
            return None
        if isinstance(o, (np.integer,)):
            return int(o)
        if isinstance(o, (np.floating,)):
            v = float(o)
            return None if (math.isnan(v) or math.isinf(v)) else v
        if isinstance(o, np.ndarray):
            return o.tolist()
        if isinstance(o, (pd.Timestamp,)):
            return o.isoformat()
        return super().default(o)

    def dumps(self, obj, **kwargs):
        """Override dumps to walk the structure and sanitize NaN."""
        obj = _sanitize(obj)
        return super().dumps(obj, **kwargs)


def _sanitize(obj):
    """Recursively replace NaN/Inf floats with None."""
    if isinstance(obj, dict):
        return {k: _sanitize(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_sanitize(v) for v in obj]
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return obj
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        v = float(obj)
        return None if (math.isnan(v) or math.isinf(v)) else v
    if isinstance(obj, np.bool_):
        return bool(obj)
    if isinstance(obj, np.ndarray):
        return _sanitize(obj.tolist())
    return obj


app = Flask(__name__, 
    template_folder='../frontend/templates',
    static_folder='../frontend/static',
    static_url_path='/static'
)
app.json_provider_class = SafeJSONProvider
app.json = SafeJSONProvider(app)
app.secret_key = os.getenv('SECRET_KEY', secrets.token_hex(32))
app.config['MAX_CONTENT_LENGTH'] = 200 * 1024 * 1024  # 200 MB
CORS(app)

# Initialize Database
db.init_database()

# ─── Helpers ────────────────────────────────

def login_required(f):
    @wraps(f)
    def decorated(*a, **kw):
        if 'user_id' not in session:
            return jsonify({'error': 'Not authenticated'}), 401
        return f(*a, **kw)
    return decorated


def owner_required(f):
    @wraps(f)
    def decorated(*a, **kw):
        if session.get('role') != 'Owner':
            return jsonify({'error': 'Admin access required'}), 403
        return f(*a, **kw)
    return decorated


def detect_column_types(df):
    date_cols, numeric_cols, categorical_cols = [], [], []
    for col in df.columns:
        if df[col].isnull().sum() > len(df) * 0.5:
            categorical_cols.append(col)
            continue
        if pd.api.types.is_numeric_dtype(df[col]):
            numeric_cols.append(col)
        elif df[col].dtype == 'object':
            sample = df[col].dropna().head(50)
            try:
                converted = pd.to_datetime(sample, errors='coerce')
                if converted.notnull().sum() > len(sample) * 0.5:
                    date_cols.append(col)
                    continue
            except Exception:
                pass
            categorical_cols.append(col)
        else:
            categorical_cols.append(col)
    return date_cols, numeric_cols, categorical_cols


# ─── Page Routes ────────────────────────────

@app.route('/')
def index():
    """Landing page - visible to everyone"""
    return render_template('landing.html')


@app.route('/auth')
def auth():
    """Authentication page - login/register"""
    if 'user_id' in session:
        return redirect(url_for('dashboard'))
    return render_template('login.html')


@app.route('/dashboard')
def dashboard():
    if 'user_id' not in session:
        return redirect(url_for('index'))
    return render_template('dashboard.html')


# ─── Auth API ───────────────────────────────

@app.route('/api/register', methods=['POST'])
def api_register():
    data = request.json or {}
    username = data.get('username', '').strip()
    password = data.get('password', '')
    email = data.get('email', '')
    business = data.get('business_name', '')
    if not username or not password:
        return jsonify({'error': 'Username and password required'}), 400
    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400
    if db.register_user(username, password, email, 'Staff', business):
        return jsonify({'message': 'Account created successfully'})
    return jsonify({'error': 'Username already exists'}), 409


@app.route('/api/login', methods=['POST'])
def api_login():
    data = request.json or {}
    user = db.authenticate_user(data.get('username', ''), data.get('password', ''))
    if user:
        session['user_id'] = user['id']
        session['username'] = user['username']
        session['role'] = user['role']
        session['business_name'] = user['business_name']
        return jsonify({
            'message': 'Login successful',
            'user': {
                'id': user['id'],
                'username': user['username'],
                'role': user['role'],
                'business_name': user['business_name'],
            }
        })
    return jsonify({'error': 'Invalid credentials'}), 401


@app.route('/api/logout', methods=['POST'])
def api_logout():
    session.clear()
    return jsonify({'message': 'Logged out'})


@app.route('/api/me')
@login_required
def api_me():
    return jsonify({
        'id': session['user_id'],
        'username': session['username'],
        'role': session['role'],
        'business_name': session.get('business_name', ''),
    })


# ─── Upload API ─────────────────────────────

@app.route('/api/upload', methods=['POST'])
@login_required
def api_upload():
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400
    f = request.files['file']
    if not f.filename:
        return jsonify({'error': 'Empty filename'}), 400

    try:
        if f.filename.endswith('.csv'):
            df = pd.read_csv(f)
        elif f.filename.endswith(('.xlsx', '.xls')):
            df = pd.read_excel(f)
        else:
            return jsonify({'error': 'Unsupported file type'}), 400

        df = df.replace([np.inf, -np.inf], np.nan)
        
        # Check if user wants to replace existing data (clear old data before inserting)
        replace_mode = request.form.get('replace', 'false').lower() == 'true'
        if replace_mode:
            db.reset_sales_data(session['user_id'])
        
        # ─── AI Column Analysis ───
        ai_analysis = ai_analyzer.analyze_columns_with_ai(df)
        
        # Auto-correct dataframe using AI suggestions
        if ai_analysis:
            df_corrected = ai_analyzer.auto_correct_dataframe(df, ai_analysis)
        else:
            df_corrected = df.copy()
            ai_analysis = {'status': 'fallback', 'message': 'Using standard detection'}
        
        # Save upload history
        db.add_upload_history(session['user_id'], f.filename, df.shape[0], df.shape[1])

        # Extract standardized columns for database
        rows_to_save = []
        
        # Map columns based on AI analysis
        col_map = ai_analysis.get('column_mappings', {}) if isinstance(ai_analysis, dict) and ai_analysis.get('status') != 'error' else {}
        
        for _, row in df_corrected.iterrows():
            try:
                # Get transaction date (API normalizes to 'date' column)
                txn_date = datetime.now().strftime('%Y-%m-%d')
                if 'date' in df_corrected.columns:
                    try:
                        txn_date = pd.to_datetime(row['date']).strftime('%Y-%m-%d')
                    except:
                        pass
                elif 'transaction_date' in df_corrected.columns:
                    try:
                        txn_date = pd.to_datetime(row['transaction_date']).strftime('%Y-%m-%d')
                    except:
                        pass
                
                # Get product name (API normalizes to 'product' column)
                product = 'Unknown'
                if 'product' in df_corrected.columns:
                    product = str(row['product']).strip() or 'Unknown'
                elif 'product_name' in df_corrected.columns:
                    product = str(row['product_name']).strip() or 'Unknown'
                
                # Get category
                category = 'General'
                if 'category' in df_corrected.columns:
                    category = str(row['category']).strip() or 'General'
                
                # Get quantity
                qty = 1
                if 'quantity' in df_corrected.columns:
                    try:
                        qty = max(int(float(row['quantity'])), 1)
                    except:
                        qty = 1
                
                # Get unit price
                unit_price = 0
                if 'unit_price' in df_corrected.columns:
                    try:
                        unit_price = float(row['unit_price']) or 0
                    except:
                        unit_price = 0
                
                # Get cost price
                cost_price = 0
                if 'cost_price' in df_corrected.columns:
                    try:
                        cost_price = float(row['cost_price']) or 0
                    except:
                        cost_price = 0
                
                # Calculate revenue and profit
                revenue = qty * unit_price
                profit = revenue - (qty * cost_price)
                
                rows_to_save.append({
                    'transaction_date': txn_date,
                    'product_name': product,
                    'category': category,
                    'quantity': qty,
                    'unit_price': unit_price,
                    'cost_price': cost_price,
                    'revenue': revenue,
                    'profit': profit,
                })
            except Exception as row_err:
                print(f"Error processing row: {row_err}")
                continue
        
        # Insert data and verify it was saved
        insert_success = False
        if rows_to_save:
            insert_success = db.insert_sales_rows(session['user_id'], rows_to_save)
            if not insert_success:
                print(f"[WARNING] Failed to insert {len(rows_to_save)} rows for user {session['user_id']}")
        
        # Add upload history (even if insert failed, we log the attempt)
        db.add_upload_history(session['user_id'], f.filename, len(rows_to_save), df.shape[1])

        # Build response
        memory_mb = round(df_corrected.memory_usage(deep=True).sum() / 1024**2, 2)
        missing = int(df_corrected.isnull().sum().sum())

        col_info = []
        for col in df_corrected.columns:
            total_rows = len(df_corrected) if len(df_corrected) > 0 else 1
            col_info.append({
                'name': col,
                'dtype': str(df_corrected[col].dtype) if hasattr(df_corrected[col], 'dtype') else 'unknown',
                'non_null': int(df_corrected[col].count()),
                'null_pct': round(float(df_corrected[col].isnull().sum() / total_rows * 100), 2),
                'unique': int(df_corrected[col].nunique()),
                'sample': str(df_corrected[col].dropna().iloc[0]) if len(df_corrected[col].dropna()) > 0 else 'N/A',
            })

        # Preview (first 20 rows)
        preview = json.loads(df_corrected.head(20).to_json(orient='records', date_format='iso'))

        # Numeric summary
        numeric_summary = {}
        numeric_cols = df_corrected.select_dtypes(include=[np.number]).columns.tolist()
        if numeric_cols:
            desc = df_corrected[numeric_cols].describe()
            numeric_summary = json.loads(desc.to_json())

        # Prepare AI analysis for response
        ai_info = {
            'ai_analysis_performed': ai_analysis is not None,
            'ai_status': ai_analysis.get('status', 'unknown') if isinstance(ai_analysis, dict) else 'error',
            'column_corrections': ai_analysis.get('column_mappings', {}) if isinstance(ai_analysis, dict) and ai_analysis.get('status') != 'error' else {},
            'detected_issues': ai_analysis.get('corrections', []) if isinstance(ai_analysis, dict) and ai_analysis.get('status') != 'error' else [],
            'missing_columns': ai_analysis.get('missing_columns', []) if isinstance(ai_analysis, dict) and ai_analysis.get('status') != 'error' else [],
            'quality_score': ai_analysis.get('quality_score', 0) if isinstance(ai_analysis, dict) and ai_analysis.get('status') != 'error' else 0,
            'summary': ai_analysis.get('summary', 'Standard detection used') if isinstance(ai_analysis, dict) else 'Standard detection used'
        }

        return jsonify({
            'message': 'File uploaded successfully' if rows_to_save and insert_success else 'File uploaded (check logs)',
            'insert_status': 'success' if insert_success else 'failed' if rows_to_save else 'no_rows',
            'rows_saved': len(rows_to_save) if insert_success else 0,
            'filename': f.filename,
            'rows': df.shape[0],
            'columns': df.shape[1],
            'memory_mb': memory_mb,
            'missing': missing,
            'date_cols': [c for c in df_corrected.columns if hasattr(df_corrected[c], 'dtype') and df_corrected[c].dtype == 'datetime64[ns]'],
            'numeric_cols': numeric_cols,
            'categorical_cols': [c for c in df_corrected.columns if hasattr(df_corrected[c], 'dtype') and df_corrected[c].dtype == 'object'],
            'col_info': col_info,
            'preview': preview,
            'numeric_summary': numeric_summary,
            'column_names': df_corrected.columns.tolist(),
            'original_columns': df.columns.tolist(),
            'ai_analysis': ai_info,
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ─── AI Column Analysis API ────────────────────────

@app.route('/api/ai/analyze-columns', methods=['POST'])
@login_required
def api_ai_analyze():
    """
    Analyze uploaded file columns using AI (OpenAI GPT).
    """
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400
    
    try:
        f = request.files['file']
        if f.filename.endswith('.csv'):
            df = pd.read_csv(f)
        elif f.filename.endswith(('.xlsx', '.xls')):
            df = pd.read_excel(f)
        else:
            return jsonify({'error': 'Unsupported file type'}), 400
        
        # Run AI analysis
        analysis = ai_analyzer.analyze_columns_with_ai(df)
        
        if not analysis:
            return jsonify({'error': 'AI analysis failed'}), 500
        
        return jsonify({
            'status': 'success',
            'analysis': analysis,
            'original_columns': df.columns.tolist(),
            'rows': len(df),
            'suggested_mappings': analysis.get('column_mappings', {}),
            'corrections_needed': analysis.get('corrections', []),
            'data_quality_score': analysis.get('quality_score', 0),
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/ai/correct-data', methods=['POST'])
@login_required
def api_ai_correct():
    """
    Apply AI-suggested corrections to data and save.
    """
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400
    
    try:
        f = request.files['file']
        if f.filename.endswith('.csv'):
            df = pd.read_csv(f)
        elif f.filename.endswith(('.xlsx', '.xls')):
            df = pd.read_excel(f)
        else:
            return jsonify({'error': 'Unsupported file type'}), 400
        
        # Get AI analysis
        analysis = ai_analyzer.analyze_columns_with_ai(df)
        
        # Auto-correct dataframe
        df_corrected = ai_analyzer.auto_correct_dataframe(df, analysis)
        
        # Save to database
        db.add_upload_history(session['user_id'], f.filename, df.shape[0], df.shape[1])
        
        rows_to_save = []
        for _, row in df_corrected.iterrows():
            try:
                txn_date = datetime.now().strftime('%Y-%m-%d')
                if 'transaction_date' in df_corrected.columns:
                    try:
                        txn_date = pd.to_datetime(row['transaction_date']).strftime('%Y-%m-%d')
                    except:
                        pass
                
                product = str(row.get('product_name', row.get('product', 'Unknown'))).strip() or 'Unknown'
                category = str(row.get('category', 'General')).strip() or 'General'
                qty = max(int(float(row['quantity'])), 1) if 'quantity' in df_corrected.columns else 1
                unit_price = float(row['unit_price']) if 'unit_price' in df_corrected.columns else 0
                cost_price = float(row['cost_price']) if 'cost_price' in df_corrected.columns else 0
                revenue = qty * unit_price
                profit = revenue - (qty * cost_price)
                
                rows_to_save.append({
                    'transaction_date': txn_date,
                    'product_name': product,
                    'category': category,
                    'quantity': qty,
                    'unit_price': unit_price,
                    'cost_price': cost_price,
                    'revenue': revenue,
                    'profit': profit,
                })
            except Exception as row_err:
                print(f"Error processing row: {row_err}")
                continue
        
        if rows_to_save:
            db.insert_sales_rows(session['user_id'], rows_to_save)
        
        return jsonify({
            'status': 'success',
            'message': 'Data corrected and saved',
            'rows_saved': len(rows_to_save),
            'corrections_applied': analysis.get('corrections', []),
            'column_mappings': analysis.get('column_mappings', {}),
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ─── Data Status API ────────────────────────

@app.route('/api/data-status')
@login_required
def api_data_status():
    """Check if user has uploaded data."""
    try:
        data = db.get_sales_data(session['user_id'], limit=1)
        has_data = len(data) > 0
        count = len(db.get_sales_data(session['user_id']))
        
        return jsonify({
            'has_data': has_data,
            'row_count': count,
            'status': 'ready' if has_data else 'no_data',
            'message': f'{count} rows uploaded' if has_data else 'Please upload data first'
        })
    except Exception as e:
        return jsonify({
            'has_data': False,
            'row_count': 0,
            'status': 'error',
            'message': f'Error checking data: {str(e)}'
        }), 500


# ─── Sales Data API ─────────────────────────

@app.route('/api/sales')
@login_required
def api_get_sales():
    limit = request.args.get('limit', 10000, type=int)
    data = db.get_sales_data(session['user_id'], limit)
    return jsonify({'data': data, 'total': len(data)})


@app.route('/api/sales/<int:record_id>', methods=['PUT'])
@login_required
def api_update_sale(record_id):
    data = request.json or {}
    # Recalculate revenue and profit
    qty = data.get('quantity', 1)
    up = data.get('unit_price', 0)
    cp = data.get('cost_price', 0)
    data['revenue'] = qty * up
    data['profit'] = data['revenue'] - (qty * cp)
    db.update_sales_record(record_id, session['user_id'], **data)
    return jsonify({'message': 'Record updated'})


@app.route('/api/sales/<int:record_id>', methods=['DELETE'])
@login_required
def api_delete_sale(record_id):
    affected = db.delete_sales_record(record_id, session['user_id'])
    if affected:
        return jsonify({'message': 'Record deleted'})
    return jsonify({'error': 'Record not found'}), 404


@app.route('/api/sales/bulk-delete', methods=['POST'])
@login_required
def api_bulk_delete_sales():
    data = request.json or {}
    affected = db.delete_sales_by_date_range(
        session['user_id'], data.get('start_date', ''), data.get('end_date', '')
    )
    return jsonify({'message': f'{affected} records deleted'})


# ─── Analytics API ──────────────────────────

@app.route('/api/analytics')
@login_required
def api_analytics():
    data = db.get_sales_data(session['user_id'])
    if not data:
        return jsonify({'error': 'No sales data found'}), 404

    df = pd.DataFrame(data)

    total_revenue = float(df['revenue'].sum())
    total_cost = float((df['cost_price'] * df['quantity']).sum())
    total_profit = float(df['profit'].sum())
    profit_margin = round(total_profit / total_revenue * 100, 2) if total_revenue else 0
    roi = round(total_profit / total_cost * 100, 2) if total_cost else 0
    avg_txn = round(total_revenue / len(df), 2) if len(df) else 0

    # Time series data
    time_series = None
    if 'transaction_date' in df.columns:
        df['transaction_date'] = pd.to_datetime(df['transaction_date'], errors='coerce')
        ts = df.dropna(subset=['transaction_date'])
        if len(ts) > 0:
            daily = ts.groupby('transaction_date').agg({
                'revenue': 'sum', 'profit': 'sum'
            }).reset_index()
            daily['cost'] = daily['revenue'] - daily['profit']
            daily['transaction_date'] = daily['transaction_date'].dt.strftime('%Y-%m-%d')
            time_series = daily.fillna(0).to_dict('records')

    # Category analysis
    cat_analysis = None
    if 'category' in df.columns:
        cat = df.groupby('category').agg({
            'revenue': 'sum',
            'profit': 'sum',
            'quantity': 'sum',
        }).reset_index()
        cat['cost'] = cat['revenue'] - cat['profit']
        cat['profit_margin'] = (cat['profit'] / cat['revenue'] * 100).round(2).replace([np.inf, -np.inf], 0).fillna(0)
        cat['roi'] = (cat['profit'] / cat['cost'] * 100).round(2).replace([np.inf, -np.inf], 0).fillna(0)
        cat = cat.sort_values('profit', ascending=False)
        # Only fillna on numeric columns for categorical data
        numeric_cols = cat.select_dtypes(include=[np.number]).columns
        cat[numeric_cols] = cat[numeric_cols].fillna(0)
        cat_analysis = cat.to_dict('records')

    # Monthly data
    monthly = None
    if 'transaction_date' in df.columns and len(ts) > 0:
        ts['month'] = ts['transaction_date'].dt.to_period('M').astype(str)
        m = ts.groupby('month').agg({'revenue': 'sum', 'profit': 'sum'}).reset_index()
        m = m.fillna(0)
        monthly = m.to_dict('records')

    # Day of week
    dow = None
    if 'transaction_date' in df.columns and len(ts) > 0:
        ts['dow'] = ts['transaction_date'].dt.day_name()
        d = ts.groupby('dow')['revenue'].mean().reset_index()
        day_order = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
        d['dow'] = pd.Categorical(d['dow'], categories=day_order, ordered=True)
        d = d.sort_values('dow')
        # Only fillna on numeric columns
        numeric_cols = d.select_dtypes(include=[np.number]).columns
        d[numeric_cols] = d[numeric_cols].fillna(0)
        dow = d.to_dict('records')

    # Correlation
    num_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    corr_data = None
    if len(num_cols) > 1:
        corr_df = df[num_cols[:6]].corr().fillna(0)
        # Convert to proper numeric lists for JSON serialization
        corr_matrix = [[float(val) for val in row] for row in corr_df.values]
        col_names = corr_df.columns.tolist()
        corr_data = {'columns': col_names, 'matrix': corr_matrix}

    # Insights
    insights = ml.generate_insights(
        df.to_dict('list'),
        'transaction_date',
        num_cols,
        ['category', 'product_name']
    )

    # Profit-specific insights
    if profit_margin > 30:
        insights.insert(0, f"🎯 Excellent profit margin of {profit_margin}%!")
    elif profit_margin > 15:
        insights.insert(0, f"✅ Healthy profit margin of {profit_margin}%")
    else:
        insights.insert(0, f"⚠️ Profit margin of {profit_margin}% - consider optimization")

    if roi > 100:
        insights.insert(1, f"💰 Exceptional ROI of {roi}%!")
    elif roi > 50:
        insights.insert(1, f"📈 Strong ROI of {roi}%")

    return jsonify({
        'kpi': {
            'total_revenue': total_revenue,
            'total_cost': total_cost,
            'total_profit': total_profit,
            'profit_margin': profit_margin,
            'roi': roi,
            'avg_transaction': avg_txn,
            'total_records': len(df),
        },
        'time_series': time_series,
        'category_analysis': cat_analysis,
        'monthly': monthly,
        'day_of_week': dow,
        'correlation': corr_data,
        'insights': insights,
    })


# ─── Profit Insights API ────────────────────

@app.route('/api/profit-insights')
@login_required
def api_profit_insights():
    data = db.get_sales_data(session['user_id'])
    if not data:
        return jsonify({
            'error': 'No sales data found',
            'message': 'Please upload your sales data file first to view profit insights',
            'has_data': False
        }), 404

    df = pd.DataFrame(data)
    df['profit'] = df['revenue'] - (df['cost_price'] * df['quantity'])
    df['profit_margin'] = (df['profit'] / df['revenue'] * 100).replace([np.inf, -np.inf], 0)
    df['roi'] = (df['profit'] / (df['cost_price'] * df['quantity']) * 100).replace([np.inf, -np.inf], 0)

    profitable = df[df['profit'] > 0]
    unprofitable = df[df['profit'] <= 0]
    breakeven = df[df['profit'] == 0]

    cat_profit = None
    if 'category' in df.columns:
        cp = df.groupby('category').agg({
            'revenue': 'sum', 'profit': 'sum', 'profit_margin': 'mean', 'roi': 'mean'
        }).reset_index()
        cp['cost'] = cp['revenue'] - cp['profit']
        cp = cp.sort_values('profit', ascending=False)
        cat_profit = cp.to_dict('records')

    return jsonify({
        'total_revenue': float(df['revenue'].sum()),
        'total_cost': float((df['cost_price'] * df['quantity']).sum()),
        'total_profit': float(df['profit'].sum()),
        'avg_margin': round(float(df['profit_margin'].mean()), 2),
        'avg_roi': round(float(df['roi'].mean()), 2),
        'profitable_count': len(profitable),
        'profitable_profit': float(profitable['profit'].sum()) if len(profitable) > 0 else 0,
        'unprofitable_count': len(unprofitable),
        'unprofitable_loss': float(unprofitable['profit'].sum()) if len(unprofitable) > 0 else 0,
        'breakeven_count': len(breakeven),
        'total_count': len(df),
        'profit_distribution': df['profit'].dropna().tolist(),
        'margin_distribution': df['profit_margin'].dropna().tolist(),
        'category_profit': cat_profit,
    })


# ─── ML API ─────────────────────────────────

@app.route('/api/ml/forecast', methods=['POST'])
@login_required
def api_forecast():
    data = request.json or {}
    values = data.get('values', [])
    periods = data.get('periods', 7)
    model_type = data.get('model_type', 'linear')
    dates = data.get('dates', [])

    if len(values) < 6:
        return jsonify({'error': 'Need at least 6 data points'}), 400

    try:
        result = ml.forecast(values, periods, model_type)
        result['dates'] = dates
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/ml/cluster', methods=['POST'])
@login_required
def api_cluster():
    data = request.json or {}
    matrix = data.get('matrix', [])
    n_clusters = data.get('n_clusters', 3)
    feature_names = data.get('feature_names', [])

    if len(matrix) < 10:
        return jsonify({'error': 'Need at least 10 data points'}), 400

    try:
        result = ml.cluster_data(matrix, n_clusters, feature_names)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/ml/outliers', methods=['POST'])
@login_required
def api_outliers():
    data = request.json or {}
    values = data.get('values', [])
    if not values:
        return jsonify({'error': 'No data provided'}), 400
    try:
        result = ml.detect_outliers(values)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/ml/decompose', methods=['POST'])
@login_required
def api_decompose():
    data = request.json or {}
    values = data.get('values', [])
    window = data.get('window', 7)
    decomp_type = data.get('decomp_type', 'additive')

    try:
        result = ml.decompose_trend(values, window, decomp_type)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/ml/stats', methods=['POST'])
@login_required
def api_stats():
    data = request.json or {}
    values = data.get('values', [])
    if not values:
        return jsonify({'error': 'No data'}), 400
    try:
        result = ml.statistical_summary(values)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/ml/correlation', methods=['POST'])
@login_required
def api_correlation():
    data = request.json or {}
    try:
        result = ml.correlation_matrix(data)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ─── Expenses API ───────────────────────────

@app.route('/api/expenses', methods=['GET'])
@login_required
def api_get_expenses():
    data = db.get_expenses(session['user_id'])
    return jsonify({'data': data})


@app.route('/api/expenses', methods=['POST'])
@login_required
def api_add_expense():
    data = request.json or {}
    db.add_expense(
        session['user_id'],
        data.get('expense_date', datetime.now().strftime('%Y-%m-%d')),
        data.get('category', 'Other'),
        float(data.get('amount', 0)),
        data.get('description', '')
    )
    return jsonify({'message': 'Expense added'})


@app.route('/api/expenses/<int:expense_id>', methods=['DELETE'])
@login_required
def api_delete_expense(expense_id):
    db.delete_expense(expense_id, session['user_id'])
    return jsonify({'message': 'Expense deleted'})


# ─── Products/Inventory API ─────────────────

@app.route('/api/products', methods=['GET'])
@login_required
def api_get_products():
    data = db.get_products(session['user_id'])
    return jsonify({'data': data})


@app.route('/api/products', methods=['POST'])
@login_required
def api_add_product():
    data = request.json or {}
    db.upsert_product(
        session['user_id'],
        data.get('product_name', ''),
        data.get('category', 'Other'),
        float(data.get('cost_price', 0)),
        float(data.get('selling_price', 0)),
        int(data.get('stock_quantity', 0))
    )
    return jsonify({'message': 'Product saved'})


@app.route('/api/products/<int:product_id>', methods=['DELETE'])
@login_required
def api_delete_product(product_id):
    db.delete_product(product_id, session['user_id'])
    return jsonify({'message': 'Product deleted'})


@app.route('/api/products/low-stock')
@login_required
def api_low_stock():
    threshold = request.args.get('threshold', 10, type=int)
    data = db.get_low_stock_products(session['user_id'], threshold)
    return jsonify({'data': data, 'threshold': threshold})


# ─── Admin API ──────────────────────────────

@app.route('/api/admin/users')
@login_required
@owner_required
def api_admin_users():
    return jsonify({'users': db.get_all_users()})


@app.route('/api/admin/users/<int:user_id>', methods=['PUT'])
@login_required
@owner_required
def api_admin_update_user(user_id):
    data = request.json or {}
    db.update_user(user_id, **data)
    return jsonify({'message': 'User updated'})


@app.route('/api/admin/users/<int:user_id>', methods=['DELETE'])
@login_required
@owner_required
def api_admin_delete_user(user_id):
    db.delete_user(user_id)
    return jsonify({'message': 'User deleted'})


@app.route('/api/admin/stats')
@login_required
@owner_required
def api_admin_stats():
    return jsonify(db.get_admin_stats())


@app.route('/api/reset/sales', methods=['POST'])
@login_required
@owner_required
def api_reset_sales():
    """Reset all sales data for the user. WARNING: Cannot be undone!"""
    user_id = session['user_id']
    db.reset_sales_data(user_id)
    return jsonify({'message': 'Sales data cleared', 'user_id': user_id})


@app.route('/api/reset/database', methods=['POST'])
@login_required
@owner_required
def api_reset_database():
    """Clean and reinitialize entire database. WARNING: Deletes all data except admin!"""
    db.clean_database()
    return jsonify({'message': 'Database cleaned and reinitialized'})


# ─── Reports / Export API ────────────────────

@app.route('/api/export/csv')
@login_required
def api_export_csv():
    data = db.get_sales_data(session['user_id'])
    if not data:
        return jsonify({'error': 'No data'}), 404
    df = pd.DataFrame(data)
    buf = io.StringIO()
    df.to_csv(buf, index=False)
    buf.seek(0)
    return send_file(
        io.BytesIO(buf.getvalue().encode()),
        mimetype='text/csv',
        as_attachment=True,
        download_name=f'sales_export_{datetime.now().strftime("%Y%m%d")}.csv'
    )


@app.route('/api/export/excel')
@login_required
def api_export_excel():
    data = db.get_sales_data(session['user_id'])
    if not data:
        return jsonify({'error': 'No data'}), 404
    df = pd.DataFrame(data)
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Sales Data')
    buf.seek(0)
    return send_file(
        buf, mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        as_attachment=True,
        download_name=f'sales_export_{datetime.now().strftime("%Y%m%d")}.xlsx'
    )


@app.route('/api/export/pdf')
@login_required
def api_export_pdf():
    if not PDF_OK:
        return jsonify({'error': 'reportlab not installed'}), 500
    data = db.get_sales_data(session['user_id'])
    if not data:
        return jsonify({'error': 'No data'}), 404
    df = pd.DataFrame(data)

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=letter)
    styles = getSampleStyleSheet()
    story = []

    title_style = ParagraphStyle('T', parent=styles['Heading1'], fontSize=22,
                                  textColor=colors.HexColor('#1e3c72'), alignment=1)
    story.append(Paragraph(f"Business Report – {datetime.now().strftime('%B %d, %Y')}", title_style))
    story.append(Spacer(1, 0.3*inch))

    summary = [
        ['Metric', 'Value'],
        ['Total Records', f"{len(df):,}"],
        ['Total Revenue', f"${df['revenue'].sum():,.2f}"],
        ['Total Profit', f"${df['profit'].sum():,.2f}"],
    ]
    t = Table(summary, colWidths=[3*inch, 3*inch])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#1e3c72')),
        ('TEXTCOLOR', (0,0), (-1,0), colors.whitesmoke),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('GRID', (0,0), (-1,-1), 1, colors.grey),
        ('BACKGROUND', (0,1), (-1,-1), colors.HexColor('#f0f4ff')),
    ]))
    story.append(t)
    story.append(Spacer(1, 0.3*inch))

    cols = ['transaction_date','product_name','category','quantity','revenue','profit']
    cols = [c for c in cols if c in df.columns]
    table_data = [cols]
    for _, row in df[cols].head(30).iterrows():
        table_data.append([str(row[c])[:18] for c in cols])
    t2 = Table(table_data)
    t2.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#2a5298')),
        ('TEXTCOLOR', (0,0), (-1,0), colors.whitesmoke),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,-1), 8),
        ('GRID', (0,0), (-1,-1), 0.5, colors.grey),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#f8f9fa')]),
    ]))
    story.append(t2)

    doc.build(story)
    buf.seek(0)
    return send_file(buf, mimetype='application/pdf', as_attachment=True,
                     download_name=f'report_{datetime.now().strftime("%Y%m%d")}.pdf')


@app.route('/api/upload-history')
@login_required
def api_upload_history():
    data = db.get_upload_history(session['user_id'])
    return jsonify({'data': data})


# ─── Run ────────────────────────────────────

if __name__ == '__main__':
    app.run(debug=True, port=5000)
