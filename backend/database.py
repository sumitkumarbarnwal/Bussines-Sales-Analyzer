"""
SQLite Database Operations for Sales & Business Analyzer
"""
import sqlite3
import os
import bcrypt
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), 'data', 'business.db')


def get_db():
    """Get a database connection with row factory."""
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=10.0)
    conn.row_factory = sqlite3.Row
    # Disable WAL mode - use simple journal mode instead
    conn.execute("PRAGMA journal_mode=DELETE")
    conn.execute("PRAGMA synchronous=NORMAL")
    conn.execute("PRAGMA cache_size=-64000")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_database():
    """Create all necessary tables."""
    try:
        conn = get_db()
        c = conn.cursor()

        c.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                email TEXT DEFAULT '',
                role TEXT DEFAULT 'Staff',
                business_name TEXT DEFAULT '',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        c.execute("""
            CREATE TABLE IF NOT EXISTS sales_data (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                transaction_date TEXT,
                product_name TEXT DEFAULT 'Unknown',
                category TEXT DEFAULT 'General',
                quantity INTEGER DEFAULT 1,
                unit_price REAL DEFAULT 0,
                cost_price REAL DEFAULT 0,
                revenue REAL DEFAULT 0,
                profit REAL DEFAULT 0,
                customer_name TEXT DEFAULT '',
                region TEXT DEFAULT '',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)

        c.execute("""
            CREATE TABLE IF NOT EXISTS expenses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                expense_date TEXT,
                category TEXT DEFAULT 'Other',
                amount REAL DEFAULT 0,
                description TEXT DEFAULT '',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)

        c.execute("""
            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                product_name TEXT NOT NULL,
                category TEXT DEFAULT 'Other',
                cost_price REAL DEFAULT 0,
                selling_price REAL DEFAULT 0,
                stock_quantity INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)

        c.execute("""
            CREATE TABLE IF NOT EXISTS upload_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                filename TEXT,
                rows INTEGER DEFAULT 0,
                columns INTEGER DEFAULT 0,
                uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)

        # Seed default admin user if not exists - use INSERT OR IGNORE for concurrent workers
        try:
            hashed = bcrypt.hashpw('admin123'.encode(), bcrypt.gensalt()).decode()
            c.execute(
                "INSERT OR IGNORE INTO users (username, password, email, role, business_name) VALUES (?,?,?,?,?)",
                ('admin', hashed, 'admin@business.com', 'Owner', 'Admin Account')
            )
        except Exception as e:
            # If admin user already exists, that's fine - just log it
            print(f"[INFO] Admin user already exists or error: {e}")

        conn.commit()
        conn.close()
        print("[OK] Database initialized successfully")
    except Exception as e:
        print(f"[ERROR] Database initialization error: {e}")
        # Don't raise - allow app to continue even if DB init fails


def reset_sales_data(user_id=None):
    """Clear all sales data for a user (or all users if user_id is None)."""
    conn = get_db()
    if user_id:
        conn.execute("DELETE FROM sales_data WHERE user_id=?", (user_id,))
    else:
        conn.execute("DELETE FROM sales_data")
    conn.commit()
    conn.close()


def clean_database():
    """Reinitialize database tables (WARNING: Deletes all data except admin user)."""
    conn = get_db()
    c = conn.cursor()
    
    # Drop and recreate tables
    c.execute("DROP TABLE IF EXISTS upload_history")
    c.execute("DROP TABLE IF EXISTS products")
    c.execute("DROP TABLE IF EXISTS expenses")
    c.execute("DROP TABLE IF EXISTS sales_data")
    
    # Recreate tables
    c.execute("""
        CREATE TABLE sales_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            transaction_date TEXT,
            product_name TEXT DEFAULT 'Unknown',
            category TEXT DEFAULT 'General',
            quantity INTEGER DEFAULT 1,
            unit_price REAL DEFAULT 0,
            cost_price REAL DEFAULT 0,
            revenue REAL DEFAULT 0,
            profit REAL DEFAULT 0,
            customer_name TEXT DEFAULT '',
            region TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    """)
    
    c.execute("""
        CREATE TABLE expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            expense_date TEXT,
            category TEXT DEFAULT 'Other',
            amount REAL DEFAULT 0,
            description TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    """)
    
    c.execute("""
        CREATE TABLE products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            product_name TEXT NOT NULL,
            category TEXT DEFAULT 'Other',
            cost_price REAL DEFAULT 0,
            selling_price REAL DEFAULT 0,
            stock_quantity INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    """)
    
    c.execute("""
        CREATE TABLE upload_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            filename TEXT,
            rows INTEGER DEFAULT 0,
            columns INTEGER DEFAULT 0,
            uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    """)
    
    conn.commit()
    conn.close()


# ──────────── AUTH ────────────

def register_user(username, password, email='', role='Staff', business_name=''):
    conn = get_db()
    hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    try:
        conn.execute(
            "INSERT INTO users (username, password, email, role, business_name) VALUES (?,?,?,?,?)",
            (username, hashed, email, role, business_name)
        )
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        return False
    finally:
        conn.close()


def authenticate_user(username, password):
    conn = get_db()
    row = conn.execute("SELECT * FROM users WHERE username=?", (username,)).fetchone()
    conn.close()
    if row and bcrypt.checkpw(password.encode(), row['password'].encode()):
        return dict(row)
    return None


def get_user_by_id(user_id):
    conn = get_db()
    row = conn.execute("SELECT * FROM users WHERE id=?", (user_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def get_all_users():
    conn = get_db()
    rows = conn.execute(
        "SELECT id, username, email, role, business_name, created_at FROM users ORDER BY id"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def update_user(user_id, **kwargs):
    conn = get_db()
    sets = []
    vals = []
    for k, v in kwargs.items():
        if k == 'password' and v:
            v = bcrypt.hashpw(v.encode(), bcrypt.gensalt()).decode()
        if v is not None:
            sets.append(f"{k}=?")
            vals.append(v)
    if sets:
        vals.append(user_id)
        conn.execute(f"UPDATE users SET {', '.join(sets)} WHERE id=?", vals)
        conn.commit()
    conn.close()


def delete_user(user_id):
    conn = get_db()
    conn.execute("DELETE FROM users WHERE id=? AND username != 'admin'", (user_id,))
    conn.commit()
    conn.close()


# ──────────── SALES DATA ────────────

def insert_sales_rows(user_id, rows):
    """Insert multiple sales rows with error handling. `rows` is a list of dicts."""
    try:
        conn = get_db()
        
        # Verify user exists before inserting (prevent foreign key errors)
        user_check = conn.execute("SELECT id FROM users WHERE id=?", (user_id,)).fetchone()
        if not user_check:
            print(f"[ERROR] User {user_id} not found - cannot insert sales data")
            conn.close()
            return False
        
        inserted_count = 0
        for r in rows:
            try:
                conn.execute("""
                    INSERT INTO sales_data
                        (user_id, transaction_date, product_name, category, quantity,
                         unit_price, cost_price, revenue, profit, customer_name, region)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?)
                """, (
                    user_id,
                    r.get('transaction_date', datetime.now().strftime('%Y-%m-%d')),
                    r.get('product_name', 'Unknown'),
                    r.get('category', 'General'),
                    r.get('quantity', 1),
                    r.get('unit_price', 0),
                    r.get('cost_price', 0),
                    r.get('revenue', 0),
                    r.get('profit', 0),
                    r.get('customer_name', ''),
                    r.get('region', ''),
                ))
                inserted_count += 1
            except Exception as row_err:
                print(f"[WARNING] Failed to insert row: {row_err}")
                continue
        
        conn.commit()
        conn.close()
        print(f"[OK] Inserted {inserted_count}/{len(rows)} sales rows for user {user_id}")
        return True
    except Exception as e:
        print(f"[ERROR] Failed to insert sales rows: {e}")
        return False


def get_sales_data(user_id, limit=10000):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM sales_data WHERE user_id=? ORDER BY transaction_date DESC LIMIT ?",
        (user_id, limit)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_all_sales_data():
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM sales_data ORDER BY transaction_date DESC"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def update_sales_record(record_id, user_id, **kwargs):
    conn = get_db()
    sets = []
    vals = []
    for k, v in kwargs.items():
        sets.append(f"{k}=?")
        vals.append(v)
    if sets:
        vals.extend([record_id, user_id])
        conn.execute(
            f"UPDATE sales_data SET {', '.join(sets)} WHERE id=? AND user_id=?", vals
        )
        conn.commit()
    conn.close()


def delete_sales_record(record_id, user_id):
    conn = get_db()
    c = conn.execute("DELETE FROM sales_data WHERE id=? AND user_id=?", (record_id, user_id))
    conn.commit()
    affected = c.rowcount
    conn.close()
    return affected


def delete_sales_by_date_range(user_id, start_date, end_date):
    conn = get_db()
    c = conn.execute(
        "DELETE FROM sales_data WHERE user_id=? AND transaction_date BETWEEN ? AND ?",
        (user_id, start_date, end_date)
    )
    conn.commit()
    affected = c.rowcount
    conn.close()
    return affected


# ──────────── EXPENSES ────────────

def add_expense(user_id, expense_date, category, amount, description=''):
    conn = get_db()
    conn.execute(
        "INSERT INTO expenses (user_id, expense_date, category, amount, description) VALUES (?,?,?,?,?)",
        (user_id, expense_date, category, amount, description)
    )
    conn.commit()
    conn.close()


def get_expenses(user_id):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM expenses WHERE user_id=? ORDER BY expense_date DESC", (user_id,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def delete_expense(expense_id, user_id):
    conn = get_db()
    conn.execute("DELETE FROM expenses WHERE id=? AND user_id=?", (expense_id, user_id))
    conn.commit()
    conn.close()


# ──────────── PRODUCTS / INVENTORY ────────────

def upsert_product(user_id, product_name, category, cost_price, selling_price, stock_quantity):
    conn = get_db()
    existing = conn.execute(
        "SELECT id FROM products WHERE user_id=? AND product_name=?",
        (user_id, product_name)
    ).fetchone()

    if existing:
        conn.execute("""
            UPDATE products SET category=?, cost_price=?, selling_price=?, stock_quantity=?
            WHERE id=?
        """, (category, cost_price, selling_price, stock_quantity, existing['id']))
    else:
        conn.execute("""
            INSERT INTO products (user_id, product_name, category, cost_price, selling_price, stock_quantity)
            VALUES (?,?,?,?,?,?)
        """, (user_id, product_name, category, cost_price, selling_price, stock_quantity))
    conn.commit()
    conn.close()


def get_products(user_id):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM products WHERE user_id=? ORDER BY product_name", (user_id,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def delete_product(product_id, user_id):
    conn = get_db()
    conn.execute("DELETE FROM products WHERE id=? AND user_id=?", (product_id, user_id))
    conn.commit()
    conn.close()


def get_low_stock_products(user_id, threshold=10):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM products WHERE user_id=? AND stock_quantity<=? ORDER BY stock_quantity ASC",
        (user_id, threshold)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ──────────── UPLOAD HISTORY ────────────

def add_upload_history(user_id, filename, rows, columns):
    """Add upload history with error handling for foreign key issues."""
    try:
        conn = get_db()
        # Verify user exists before inserting
        user_check = conn.execute("SELECT id FROM users WHERE id=?", (user_id,)).fetchone()
        if not user_check:
            print(f"[WARNING] User {user_id} not found, skipping upload history")
            conn.close()
            return
        
        conn.execute(
            "INSERT INTO upload_history (user_id, filename, rows, columns) VALUES (?,?,?,?)",
            (user_id, filename, rows, columns)
        )
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"[ERROR] Failed to add upload history: {e}")
        # Don't crash - continue anyway


def get_upload_history(user_id):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM upload_history WHERE user_id=? ORDER BY uploaded_at DESC", (user_id,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ──────────── ADMIN STATS ────────────

def get_admin_stats():
    conn = get_db()
    stats = {}
    stats['users'] = conn.execute("SELECT COUNT(*) as c FROM users").fetchone()['c']
    stats['sales'] = conn.execute("SELECT COUNT(*) as c FROM sales_data").fetchone()['c']
    stats['revenue'] = conn.execute("SELECT COALESCE(SUM(revenue),0) as s FROM sales_data").fetchone()['s']
    stats['profit'] = conn.execute("SELECT COALESCE(SUM(profit),0) as s FROM sales_data").fetchone()['s']
    stats['expenses_total'] = conn.execute("SELECT COALESCE(SUM(amount),0) as s FROM expenses").fetchone()['s']
    stats['products'] = conn.execute("SELECT COUNT(*) as c FROM products").fetchone()['c']
    stats['expense_records'] = conn.execute("SELECT COUNT(*) as c FROM expenses").fetchone()['c']
    conn.close()
    return stats
