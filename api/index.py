import sys
import os

# إضافة جذر المشروع إلى مسار البحث حتى يمكن استيراد app
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from vercel_python_wsgi import make_lambda_handler
from app import app

handler = make_lambda_handler(app)
