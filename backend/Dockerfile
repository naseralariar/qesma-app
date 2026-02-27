FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements/base.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

COPY . /app

# Ensure fonts directory exists for Arabic font support
RUN mkdir -p /app/backend/assets/fonts /app/backend/assets/images

# Copy fonts and images to the correct location in container
COPY assets/fonts/ /app/backend/assets/fonts/
COPY assets/images/ /app/backend/assets/images/

CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "4"]