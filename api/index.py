import sys
import os

# إضافة جذر المشروع إلى مسار البحث حتى يمكن استيراد app
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app

