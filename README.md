# النظام الشامل لتوزيع حصيلة التنفيذ - دولة الكويت

مشروع حكومي احترافي لإدارة **قسمة غرماء الديون** وفق المادة 282 وما بعدها، مبني على:
- Backend: Django + DRF + JWT
- Frontend: React (Vite) + Material UI
- Database: PostgreSQL
- Deployment: Docker Compose

## الميزات الأمنية
- تشفير كلمات المرور: PBKDF2
- JWT Authentication
- CSRF + CORS مضبوط
- SQL Injection Protection عبر ORM
- Rate Limiting عبر DRF Throttling
- قفل الحساب بعد محاولات فاشلة عبر django-axes
- Audit Log لعمليات CRUD/Print
- RBAC حسب الدور + نطاق الإدارة

## بنية المشروع
- `backend/`: API والخوارزمية وقاعدة البيانات
- `frontend/`: واجهة المستخدم الرسمية
- `docs/ERD.md`: مخطط الكيانات والعلاقات
- `docs/RBAC.md`: مصفوفة الصلاحيات
- `docker-compose.yml`: تشغيل متكامل

## التشغيل المحلي (Docker)
```bash
docker compose up --build
```

ثم افتح:
- الواجهة: `http://localhost`
- API: `http://localhost/api`
- Admin: `http://localhost/admin`

### بيانات الدخول الافتراضية
- Username: `admin`
- Password: `ChangeMe@123`

> غيّر كلمة المرور فور أول تسجيل دخول في بيئة الإنتاج.

### أوامر التهيئة (Seed + Admin)
```bash
cd backend
python manage.py seed_departments
python manage.py ensure_admin --username admin --password "StrongPassword!123" --department-code EXE-01
python manage.py bootstrap_system --username admin --password "StrongPassword!123" --department-code EXE-01
```

## التشغيل اليدوي (بدون Docker)
### Backend
```bash
cd backend
python -m venv .venv
.venv\\Scripts\\activate
pip install -r requirements/base.txt
python manage.py makemigrations
python manage.py migrate
python manage.py runserver
```

### تحقق بديل سريع بدون Docker (SQLite)
```bash
cd backend
set DB_ENGINE=sqlite
python manage.py makemigrations accounts core distributions reports
python manage.py migrate
python manage.py bootstrap_system --username admin --password "ChangeMe@123" --department-code EXE-01
python manage.py runserver 127.0.0.1:8000
```

### تحقق تلقائي بخطوة واحدة (PowerShell)
```powershell
./scripts/verify-local.ps1
```

### تحقق تلقائي مع تقرير JSON
```powershell
./scripts/verify-local-report.ps1 -OutputPath "./artifacts/verification-report.json"
```

ينتج ملف تقرير يحتوي الحالة العامة ونتائج كل خطوة وتفاصيل زمن التنفيذ.

### تحقق + رفع التقرير تلقائياً إلى SIEM/Monitoring
```powershell
./scripts/verify-local-report-upload.ps1 `
	-OutputPath "./artifacts/verification-report.json" `
	-UploadEndpoint "https://internal-monitoring.example.local/api/health/verification" `
	-BearerToken "<TOKEN>"
```

بديل API Key:
```powershell
./scripts/verify-local-report-upload.ps1 `
	-UploadEndpoint "https://internal-monitoring.example.local/api/health/verification" `
	-ApiKey "<API_KEY>" `
	-ApiKeyHeader "x-api-key"
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## نقاط وظيفية رئيسية
- شاشة دخول رسمية بخلفية قصر العدل
- Dashboard: إجماليات القساميات والمبالغ
- إدخال قسمة جديدة + دائنين
- خوارزمية توزيع قانونية بـDecimal ومنع أخطاء الكسور
- بحث واسترجاع
- توليد تباليغ حضور A4 (صفحة لكل شخص)
- توليد محضر جلسة توزيع من صفحتين
- طباعة قائمة توزيع متعددة الصفحات

## ملاحظات إنتاجية
- استبدل القيم في `backend/.env.example` قبل النشر.
- اربط الواجهة مع SSO أو Active Directory إذا لزم بيئة حكومية.
- يوصى بإضافة Redis للـcache/queue عند التوسع الكبير.

### تشغيل Production عبر Docker Compose (موصى به قبل الرفع)
1) أنشئ ملف إعدادات Django للإنتاج:
```bash
cp backend/.env.production.template backend/.env.production
```

2) أنشئ ملف متغيرات Compose للإنتاج:
```bash
cp .env.compose.example .env
```

3) عدّل القيم الحساسة في `backend/.env.production` و`.env` (خصوصًا كلمات المرور والدومينات).

4) افحص صحة الإعداد قبل التشغيل:
```bash
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml config
```

5) شغّل الإنتاج:
```bash
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml up --build -d
```

### Nginx + SSL على VPS (إعداد جاهز)
1) جهّز بيئة الإنتاج:
```bash
cp .env.compose.example .env
cp backend/.env.production.template backend/.env.production
```

2) شغّل الحاويات على VPS بملف مخصص (الواجهة داخليًا على 127.0.0.1:8080):
```bash
docker compose --env-file .env -f docker-compose.vps.yml up --build -d
```

3) انسخ ملف Nginx الجاهز وعدّل الدومين:
```bash
sudo cp deploy/nginx/qesma-ssl.conf /etc/nginx/sites-available/qesma
sudo nano /etc/nginx/sites-available/qesma
```

4) فعّل الموقع:
```bash
sudo ln -s /etc/nginx/sites-available/qesma /etc/nginx/sites-enabled/qesma
sudo nginx -t
sudo systemctl reload nginx
```

5) استخرج شهادة SSL:
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.example.com
```

6) تأكد من التجديد التلقائي:
```bash
sudo certbot renew --dry-run
```

## Postman
- ملف المجموعة الجاهز: `postman/Qesma-API.postman_collection.json`
- استورد الملف ثم شغّل طلب `Auth - Login` أولًا لتخزين `accessToken` تلقائيًا.

## UAT
- قائمة اختبار قبول المستخدم (UAT): `docs/UAT_CHECKLIST.md`

## Automated Tests
### Backend (Django)
```bash
cd backend
set DB_ENGINE=sqlite
python manage.py test apps.distributions.tests -v 2
```

اختبارات الحسابات والمصادقة والتدقيق:
```bash
cd backend
set DB_ENGINE=sqlite
python manage.py test apps.accounts.tests -v 2
```

اختبارات التقارير والطباعة والصلاحيات:
```bash
cd backend
set DB_ENGINE=sqlite
python manage.py test apps.reports.tests -v 2
```

تشغيل الاختبارين الأساسيين معًا:
```bash
cd backend
set DB_ENGINE=sqlite
python manage.py test apps.distributions.tests apps.accounts.tests -v 2
```

تشغيل الحزمة الأساسية الكاملة:
```bash
cd backend
set DB_ENGINE=sqlite
python manage.py test apps.distributions.tests apps.accounts.tests apps.reports.tests -v 2
```

لتشغيل جميع اختبارات Django:
```bash
cd backend
set DB_ENGINE=sqlite
python manage.py test -v 2
```

## CI (GitHub Actions)
- ملف الإعداد: `.github/workflows/ci.yml`
- ينفذ تلقائيًا عند `push` و`pull_request`:
	- فحص Django (`manage.py check`)
	- تشغيل الاختبارات الأساسية: `distributions + accounts + reports`
	- بناء الواجهة الأمامية (`npm run build`)
