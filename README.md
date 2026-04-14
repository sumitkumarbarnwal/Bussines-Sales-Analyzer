# Sales & Business Analyzer

A Flask-based web application for sales tracking, inventory management, business analytics, and ML-powered forecasting.

## Project Structure

```
├── frontend/
│   ├── static/
│   │   ├── css/
│   │   └── js/
│   └── templates/
│
├── backend/
│   ├── app.py              # Main Flask application
│   ├── database.py         # Database operations
│   ├── ml_models.py        # Machine learning models
│   ├── ai_analyzer.py      # AI analysis features
│   ├── requirements.txt    # Python dependencies
│   └── data/               # Data storage
│
├── Dockerfile              # Docker configuration
├── docker-compose.yml      # Docker Compose orchestration
└── .env.example           # Environment variables template
```

## Local Development

### Prerequisites
- Python 3.11+
- Flask 3.1.0
- Pandas, NumPy, scikit-learn

### Setup

1. **Create virtual environment:**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. **Install dependencies:**
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

3. **Run the application:**
   ```bash
   python app.py
   ```

4. **Access the app:**
   - Open http://localhost:5000 in your browser

## Docker Deployment

### Prerequisites
- Docker
- Docker Compose

### Quick Start

1. **Build and run:**
   ```bash
   docker-compose up -d
   ```

2. **Access the app:**
   - http://localhost:5000

3. **View logs:**
   ```bash
   docker-compose logs -f sales-analyzer
   ```

4. **Stop the application:**
   ```bash
   docker-compose down
   ```

### Environment Variables

Create a `.env` file from the template:

```bash
cp .env.example .env
```

Edit `.env` and set your configuration:
- `SECRET_KEY`: Set a secure random key for Flask sessions
- `FLASK_ENV`: Set to `production` for deployment

### Volume Mounting

The `data/` directory is persisted using Docker volumes:
```yaml
volumes:
  - ./backend/data:/app/backend/data
```

Data will be saved across container restarts.

## Features

- **Authentication**: User login and role-based access control
- **Dashboard**: Real-time analytics and insights
- **Sales Management**: Track and analyze sales data
- **Inventory**: Manage product inventory
- **Expenses**: Track business expenses
- **ML Forecasting**: Predict future sales trends
- **Advanced Analytics**: Clustering, outlier detection, decomposition
- **Data Upload**: CSV/Excel file import
- **PDF Export**: Generate reports
- **Admin Panel**: User management and statistics

## API Endpoints

### Authentication
- `POST /api/login` - User login
- `POST /api/logout` - User logout
- `GET /api/me` - Current user info

### Data
- `GET /api/sales` - Get sales data
- `GET /api/products` - Get product list
- `GET /api/analytics` - Get analytics
- `GET /api/expenses` - Get expenses
- `GET /api/profit-insights` - Profit analysis

### ML/AI
- `POST /api/ml/forecast` - Sales forecasting
- `POST /api/ml/cluster` - Customer clustering
- `POST /api/ml/outliers` - Anomaly detection
- `POST /api/ml/decompose` - Time series decomposition
- `POST /api/ml/stats` - Statistical analysis

### Admin
- `GET /api/admin/users` - List users
- `GET /api/admin/stats` - Admin statistics

## Technology Stack

### Backend
- **Framework**: Flask 3.1.0
- **Database**: SQLite
- **ML/Analytics**: scikit-learn, pandas, numpy, scipy
- **Authentication**: bcrypt
- **CORS**: flask-cors
- **Export**: reportlab (PDF)
- **Data Formats**: openpyxl (Excel)

### Frontend
- **HTML5**: Responsive templates
- **CSS3**: Modern styling
- **JavaScript**: Client-side logic
- **AJAX**: Asynchronous API calls

## Security Notes

⚠️ **Development Only**: This setup is for development purposes. For production:

1. Use a production WSGI server (Gunicorn, uWSGI)
2. Enable HTTPS/SSL
3. Set strong SECRET_KEY
4. Use environment-based configuration
5. Set up proper database backups
6. Configure CORS appropriately
7. Add rate limiting
8. Use reverse proxy (Nginx, Apache)

## Troubleshooting

### Port 5000 already in use
Change the port mapping in `docker-compose.yml`:
```yaml
ports:
  - "8000:5000"
```

### Database errors
Restart the container to reinitialize:
```bash
docker-compose restart sales-analyzer
```

### Permission issues with volumes
Ensure the `backend/data/` directory is writable:
```bash
chmod -R 755 backend/data/
```

## License

Private / Internal Use Only

## Support

For issues or questions, refer to the application logs:
```bash
docker-compose logs sales-analyzer
```
