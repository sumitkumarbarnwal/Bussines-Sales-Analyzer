"""
Machine Learning Models for Sales & Business Analyzer
Provides forecasting, clustering, outlier detection, trend decomposition, and statistical analysis.
"""
import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import StandardScaler, PolynomialFeatures
from sklearn.cluster import KMeans
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from scipy import stats


# ──────────────────────────────────────────────
# FORECASTING
# ──────────────────────────────────────────────

def forecast(values, periods=7, model_type='auto'):
    """
    Forecast future values with automatic model selection.
    values: list/array of numeric values (ordered chronologically)
    periods: number of future periods to predict
    model_type: 'auto', 'linear', 'poly2', 'poly3', 'moving_avg', 'exp_smooth', 'seasonal'
    Returns dict with predictions, confidence bands, model metrics.
    """
    y = np.array(values, dtype=float)
    n = len(y)
    X = np.arange(n).reshape(-1, 1)

    fitted = None
    future_y = None
    best_model_type = model_type
    
    # Auto-select best model by testing multiple models
    if model_type == 'auto':
        models_to_test = []
        best_r2 = -np.inf
        
        # Test polynomial model
        try:
            poly = PolynomialFeatures(degree=2, include_bias=False)
            X_poly = poly.fit_transform(X)
            lr_model = LinearRegression()
            lr_model.fit(X_poly, y)
            fitted_test = lr_model.predict(X_poly)
            ss_res = np.sum((y - fitted_test) ** 2)
            ss_tot = np.sum((y - y.mean()) ** 2)
            r2_test = 1 - ss_res / ss_tot if ss_tot > 0 else 0
            models_to_test.append(('poly2', r2_test, poly, lr_model))
            if r2_test > best_r2:
                best_r2 = r2_test
                best_model_type = 'poly2'
        except:
            pass
            
        # Test exponential smoothing (better for trends)
        try:
            alpha = 0.3
            fitted_test = np.zeros(n)
            fitted_test[0] = y[0]
            for i in range(1, n):
                fitted_test[i] = alpha * y[i] + (1 - alpha) * fitted_test[i - 1]
            ss_res = np.sum((y - fitted_test) ** 2)
            ss_tot = np.sum((y - y.mean()) ** 2)
            r2_test = 1 - ss_res / ss_tot if ss_tot > 0 else 0
            if r2_test > best_r2:
                best_r2 = r2_test
                best_model_type = 'exp_smooth'
        except:
            pass
        
        # Default to poly2 if auto-selection didn't find a model
        if best_model_type == 'auto':
            best_model_type = 'poly2'
        
        model_type = best_model_type

    if model_type == 'linear':
        model = LinearRegression()
        model.fit(X, y)
        fitted = model.predict(X)
        future_X = np.arange(n, n + periods).reshape(-1, 1)
        future_y = model.predict(future_X)

    elif model_type in ('poly2', 'poly3'):
        degree = 2 if model_type == 'poly2' else 3
        poly = PolynomialFeatures(degree=degree, include_bias=False)
        X_poly = poly.fit_transform(X)
        model = LinearRegression()
        model.fit(X_poly, y)
        fitted = model.predict(X_poly)
        future_X = np.arange(n, n + periods).reshape(-1, 1)
        future_X_poly = poly.transform(future_X)
        future_y = model.predict(future_X_poly)

    elif model_type == 'moving_avg':
        # Adaptive window size based on data length
        window = max(3, min(7, n // 4)) if n > 2 else 1
        fitted = pd.Series(y).rolling(window=window, min_periods=1).mean().values
        # Use weighted average of last values for forecast
        last_window = y[-window:] if n >= window else y
        weights = np.arange(1, len(last_window) + 1)
        weighted_mean = np.average(last_window, weights=weights)
        future_y = np.full(periods, weighted_mean)

    elif model_type == 'exp_smooth':
        # Optimize alpha based on minimal error
        alpha = 0.2  # Increased smoothing for more stable forecasts
        fitted = np.zeros(n)
        fitted[0] = y[0]
        for i in range(1, n):
            fitted[i] = alpha * y[i] + (1 - alpha) * fitted[i - 1]
        # Add trend component for better predictions
        trend = (fitted[-1] - fitted[max(0, n-7)] if n >= 7 else 0) / (n-1) if n > 1 else 0
        future_y = np.array([fitted[-1] + (i+1) * trend for i in range(periods)])

    elif model_type == 'seasonal':
        # Handle seasonal patterns
        if n >= 7:
            seasonal_period = 7  # Weekly pattern
            detrended = y - np.mean(y)
            seasonal_pattern = np.array([np.mean(detrended[i::seasonal_period]) for i in range(seasonal_period)])
            trend = np.poly1d(np.polyfit(X.flatten(), y, 1))(X.flatten())
            fitted = trend + np.tile(seasonal_pattern, int(np.ceil(n / seasonal_period)))[:n]
            future_trend = np.poly1d(np.polyfit(X.flatten(), y, 1))(np.arange(n, n + periods))
            future_seasonal = np.tile(seasonal_pattern, int(np.ceil(periods / seasonal_period)))[:periods]
            future_y = future_trend + future_seasonal
        else:
            # Fall back to polynomial if not enough data
            poly = PolynomialFeatures(degree=2, include_bias=False)
            X_poly = poly.fit_transform(X)
            model = LinearRegression()
            model.fit(X_poly, y)
            fitted = model.predict(X_poly)
            future_X = np.arange(n, n + periods).reshape(-1, 1)
            future_X_poly = poly.transform(future_X)
            future_y = model.predict(future_X_poly)

    else:
        raise ValueError(f"Unknown model type: {model_type}")

    # Metrics
    residuals = y - fitted
    std_error = float(np.std(residuals)) if len(residuals) > 0 else 0
    conf_95 = 1.96 * std_error

    ss_res = np.sum(residuals ** 2)
    ss_tot = np.sum((y - y.mean()) ** 2)
    r2 = float(1 - ss_res / ss_tot) if ss_tot > 0 else 0
    mae = float(mean_absolute_error(y, fitted))
    rmse = float(np.sqrt(mean_squared_error(y, fitted)))

    trend_change = float((future_y[-1] - y[-1]) / abs(y[-1]) * 100) if y[-1] != 0 else 0

    return {
        'fitted': fitted.tolist(),
        'forecast': future_y.tolist(),
        'upper_bound': (future_y + conf_95).tolist(),
        'lower_bound': (future_y - conf_95).tolist(),
        'r2': round(r2, 4),
        'mae': round(mae, 2),
        'rmse': round(rmse, 2),
        'trend_change_pct': round(trend_change, 2),
        'trend_direction': 'up' if future_y[-1] > y[-1] else 'down',
        'std_error': round(std_error, 2),
        'model_used': best_model_type,
    }


# ──────────────────────────────────────────────
# CLUSTERING
# ──────────────────────────────────────────────

def cluster_data(data_matrix, n_clusters=3, feature_names=None):
    """
    Perform KMeans clustering with quality metrics.
    data_matrix: 2D array-like (rows = samples, cols = features)
    Returns cluster labels, centroids, statistics, and silhouette scores.
    """
    from sklearn.metrics import silhouette_score, davies_bouldin_score
    
    X = np.array(data_matrix, dtype=float)

    # Remove rows with NaN
    mask = ~np.isnan(X).any(axis=1)
    X_clean = X[mask]

    if len(X_clean) < n_clusters:
        raise ValueError(f"Not enough data points for {n_clusters} clusters. Need at least {n_clusters} points.")

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X_clean)

    # Use requested cluster count (don't auto-optimize)
    kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
    labels = kmeans.fit_predict(X_scaled)

    # Calculate quality metrics
    silhouette_avg = silhouette_score(X_scaled, labels)
    davies_bouldin = davies_bouldin_score(X_scaled, labels)

    # Cluster statistics (in original scale)
    cluster_stats = []
    for i in range(n_clusters):
        cluster_mask = labels == i
        cluster_data_subset = X_clean[cluster_mask]
        stat = {
            'cluster': i,
            'size': int(cluster_mask.sum()),
            'size_pct': round(float(cluster_mask.sum() / len(labels) * 100), 1),
            'means': cluster_data_subset.mean(axis=0).tolist(),
            'stds': cluster_data_subset.std(axis=0).tolist(),
        }
        cluster_stats.append(stat)

    # Prepare scatter data for 2D/3D visualization
    scatter_points = []
    for idx in range(len(X_clean)):
        point = {'cluster': int(labels[idx])}
        for fi in range(min(3, X_clean.shape[1])):
            key = feature_names[fi] if feature_names and fi < len(feature_names) else f'feature_{fi}'
            point[key] = float(X_clean[idx, fi])
        scatter_points.append(point)

    sizes = [int((labels == i).sum()) for i in range(n_clusters)]

    return {
        'labels': labels.tolist(),
        'valid_indices': np.where(mask)[0].tolist(),
        'cluster_stats': cluster_stats,
        'scatter_points': scatter_points,
        'cluster_sizes': sizes,
        'inertia': float(kmeans.inertia_),
        'silhouette_score': round(silhouette_avg, 4),
        'davies_bouldin_score': round(davies_bouldin, 4),
        'n_clusters_used': n_clusters,
        'feature_names': feature_names or [f'feature_{i}' for i in range(X_clean.shape[1])],
        'quality_note': 'Higher silhouette (max 1) and lower Davies-Bouldin are better' if silhouette_avg > -1 else 'Try adjusting number of clusters',
    }


# ──────────────────────────────────────────────
# OUTLIER DETECTION
# ──────────────────────────────────────────────

def detect_outliers(values):
    """
    Detect outliers using IQR and Z-score methods combined.
    Returns statistics and indices of outliers.
    """
    arr = np.array(values, dtype=float)
    arr_clean = arr[~np.isnan(arr)]

    if len(arr_clean) < 3:
        return {
            'q1': 0, 'q3': 0, 'iqr': 0, 'lower_bound': 0, 'upper_bound': 0,
            'outlier_count': 0, 'outlier_pct': 0, 'outlier_indices': [],
            'outlier_values': [], 'total_count': len(arr_clean), 'mean': 0,
            'median': 0, 'std': 0, 'method': 'insufficient data'
        }

    q1 = float(np.percentile(arr_clean, 25))
    q3 = float(np.percentile(arr_clean, 75))
    iqr = q3 - q1
    lower_iqr = q1 - 1.5 * iqr
    upper_iqr = q3 + 1.5 * iqr

    # Z-score method (more sensitive, good for detecting extreme outliers)
    mean = float(np.mean(arr_clean))
    std = float(np.std(arr_clean))
    
    if std > 0:
        z_scores = np.abs((arr_clean - mean) / std)
        # Use |z| > 2.5 for outliers (more conservative than 3)
        z_outliers = z_scores > 2.5
    else:
        z_outliers = np.zeros(len(arr_clean), dtype=bool)

    # Combine both methods
    outlier_mask_iqr = (arr_clean < lower_iqr) | (arr_clean > upper_iqr)
    outlier_mask_combined = outlier_mask_iqr | z_outliers

    outlier_indices = np.where(outlier_mask_combined)[0].tolist()
    outlier_values = arr_clean[outlier_mask_combined].tolist()

    return {
        'q1': round(q1, 2),
        'q3': round(q3, 2),
        'iqr': round(iqr, 2),
        'lower_bound': round(lower_iqr, 2),
        'upper_bound': round(upper_iqr, 2),
        'outlier_count': len(outlier_indices),
        'outlier_pct': round(len(outlier_indices) / len(arr_clean) * 100, 2) if len(arr_clean) > 0 else 0,
        'outlier_indices': outlier_indices,
        'outlier_values': outlier_values,
        'total_count': len(arr_clean),
        'mean': round(mean, 2),
        'median': round(float(np.median(arr_clean)), 2),
        'std': round(std, 2),
        'method': 'IQR + Z-score (combined)',
    }


# ──────────────────────────────────────────────
# TREND DECOMPOSITION
# ──────────────────────────────────────────────

def decompose_trend(values, window=7, decomp_type='additive'):
    """
    Decompose time series into trend, seasonal, and residual.
    """
    y = np.array(values, dtype=float)
    n = len(y)

    if n < window * 2:
        raise ValueError("Not enough data points for decomposition")

    # Trend: centred moving average
    trend = pd.Series(y).rolling(window=window, center=True).mean().values

    if decomp_type == 'additive':
        seasonal = y - trend
        seasonal_avg = pd.Series(seasonal).rolling(window=window, center=True).mean().values
        residual = seasonal - seasonal_avg
    else:
        with np.errstate(divide='ignore', invalid='ignore'):
            seasonal = np.where(trend != 0, y / trend, np.nan)
        seasonal_avg = pd.Series(seasonal).rolling(window=window, center=True).mean().values
        with np.errstate(divide='ignore', invalid='ignore'):
            residual = np.where(seasonal_avg != 0, seasonal / seasonal_avg, np.nan)

    # Clean NaN for JSON
    def clean(a):
        return [None if np.isnan(v) else round(float(v), 4) for v in a]

    # Statistics
    valid_trend = trend[~np.isnan(trend)]
    trend_slope = 0
    if len(valid_trend) > 1:
        trend_slope = float((valid_trend[-1] - valid_trend[0]) / len(valid_trend))

    valid_seasonal = seasonal[~np.isnan(seasonal)]
    seasonal_strength = float(np.std(valid_seasonal) / np.std(y)) if np.std(y) > 0 else 0

    # Autocorrelation lag-1
    lag1_corr = 0
    if n > 2:
        try:
            lag1_corr, _ = stats.pearsonr(y[:-1], y[1:])
            lag1_corr = round(float(lag1_corr), 4)
        except Exception:
            pass

    return {
        'original': clean(y),
        'trend': clean(trend),
        'seasonal': clean(seasonal),
        'residual': clean(residual),
        'trend_slope': round(trend_slope, 4),
        'trend_direction': 'up' if trend_slope > 0 else ('down' if trend_slope < 0 else 'flat'),
        'seasonal_strength': round(seasonal_strength, 4),
        'lag1_autocorrelation': lag1_corr,
    }


# ──────────────────────────────────────────────
# STATISTICAL ANALYSIS
# ──────────────────────────────────────────────

def statistical_summary(values):
    """Full statistical summary of a numeric array."""
    arr = np.array(values, dtype=float)
    arr = arr[~np.isnan(arr)]

    if len(arr) == 0:
        return {'error': 'No valid data'}

    # Normality test
    try:
        stat_val, p_val = stats.normaltest(arr)
    except Exception:
        stat_val, p_val = 0, 1

    percentiles = [10, 25, 50, 75, 90, 95, 99]
    pct_values = {f'p{p}': round(float(np.percentile(arr, p)), 2) for p in percentiles}

    ci_95_lower = float(arr.mean() - 1.96 * arr.std() / np.sqrt(len(arr)))
    ci_95_upper = float(arr.mean() + 1.96 * arr.std() / np.sqrt(len(arr)))

    return {
        'count': len(arr),
        'mean': round(float(arr.mean()), 2),
        'median': round(float(np.median(arr)), 2),
        'std': round(float(arr.std()), 2),
        'variance': round(float(arr.var()), 2),
        'min': round(float(arr.min()), 2),
        'max': round(float(arr.max()), 2),
        'skewness': round(float(stats.skew(arr)), 4),
        'kurtosis': round(float(stats.kurtosis(arr)), 4),
        'ci_95_lower': round(ci_95_lower, 2),
        'ci_95_upper': round(ci_95_upper, 2),
        'normality_stat': round(float(stat_val), 4),
        'normality_pvalue': round(float(p_val), 4),
        'is_normal': bool(p_val > 0.05),
        'percentiles': pct_values,
    }


# ──────────────────────────────────────────────
# CORRELATION MATRIX
# ──────────────────────────────────────────────

def correlation_matrix(data_dict):
    """
    Compute correlation matrix.
    data_dict: {column_name: [values...], ...}
    """
    df = pd.DataFrame(data_dict)
    numeric_df = df.select_dtypes(include=[np.number]).dropna()
    corr = numeric_df.corr()
    return {
        'columns': corr.columns.tolist(),
        'matrix': corr.values.tolist(),
    }


# ──────────────────────────────────────────────
# INSIGHTS GENERATOR
# ──────────────────────────────────────────────

def generate_insights(df_dict, date_col=None, numeric_cols=None, categorical_cols=None):
    """Generate advanced business insights from data."""
    df = pd.DataFrame(df_dict)
    insights = []

    try:
        # Date-based insights
        if date_col and numeric_cols and date_col in df.columns:
            df[date_col] = pd.to_datetime(df[date_col], errors='coerce')
            df_clean = df.dropna(subset=[date_col])

            if len(df_clean) > 0:
                df_clean['month'] = df_clean[date_col].dt.month
                df_clean['day_of_week'] = df_clean[date_col].dt.day_name()
                df_clean['date_only'] = df_clean[date_col].dt.date

                month_names = {1:'Jan',2:'Feb',3:'Mar',4:'Apr',5:'May',6:'Jun',
                               7:'Jul',8:'Aug',9:'Sep',10:'Oct',11:'Nov',12:'Dec'}

                for num_col in (numeric_cols or [])[:3]:
                    if num_col in df_clean.columns:
                        # Monthly trends
                        monthly = df_clean.groupby('month')[num_col].agg(['sum', 'mean', 'count'])
                        if len(monthly) > 1:
                            best_month = monthly['sum'].idxmax()
                            worst_month = monthly['sum'].idxmin()
                            best_val = monthly['sum'].max()
                            worst_val = monthly['sum'].min()
                            
                            # Calculate trend
                            if len(monthly) > 2:
                                trend = (monthly['sum'].iloc[-1] - monthly['sum'].iloc[0]) / monthly['sum'].iloc[0] * 100 if monthly['sum'].iloc[0] > 0 else 0
                                if trend > 10:
                                    insights.append(f"📈 Strong growth trend: {num_col} increased {round(trend,1)}%")
                                elif trend < -10:
                                    insights.append(f"📉 Declining trend: {num_col} decreased {round(abs(trend),1)}%")

                            insights.append(f"🏆 Peak month for {num_col}: {month_names.get(best_month, best_month)} (${round(best_val, 0) if isinstance(best_val, (int, float)) else best_val})")
                            insights.append(f"📊 Lowest month: {month_names.get(worst_month, worst_month)} (${round(worst_val, 0) if isinstance(worst_val, (int, float)) else worst_val})")

                        # Day of week performance
                        dow = df_clean.groupby('day_of_week')[num_col].mean()
                        day_order = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
                        dow_sorted = dow.reindex([d for d in day_order if d in dow.index])
                        if len(dow_sorted) > 0:
                            best_day = dow_sorted.idxmax()
                            insights.append(f"📅 Best day: {best_day} for {num_col}")

        # Categorical insights
        if categorical_cols and numeric_cols:
            for cat in (categorical_cols or [])[:2]:
                if cat in df.columns:
                    for num in (numeric_cols or [])[:2]:
                        if num in df.columns:
                            try:
                                grouped = df.groupby(cat)[num].agg(['sum', 'count', 'mean']).sort_values('sum', ascending=False)
                                if len(grouped) > 0:
                                    top_val = grouped.index[0]
                                    top_sum = grouped['sum'].iloc[0]
                                    insights.append(f"🎯 Top {cat} by {num}: {top_val}")
                                    
                                    # Diversity insight
                                    if len(grouped) > 1:
                                        concentration = (grouped['sum'].iloc[0] / grouped['sum'].sum() * 100) if grouped['sum'].sum() > 0 else 0
                                        insights.append(f"⚖️ {top_val} represents {round(concentration, 1)}% of total {num}")
                            except:
                                pass

        # Data quality insights
        missing_pct = (df.isnull().sum().sum() / (len(df) * len(df.columns)) * 100) if len(df) > 0 else 0
        if missing_pct > 5:
            insights.append(f"⚠️ Data quality: {round(missing_pct, 1)}% missing values")
        else:
            insights.append(f"✅ Data quality good: {round(missing_pct, 1)}% missing values")

    except Exception as e:
        insights.append(f"⚠️ Partial analysis: {str(e)[:50]}")

    return insights or ["No specific insights available - upload more data for better analysis"]
