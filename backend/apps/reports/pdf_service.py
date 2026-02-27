from io import BytesIO
from pathlib import Path
from datetime import date

import sys
logfile = open("/app/printlog.txt", "a", encoding="utf-8")
sys.stdout = logfile
sys.stderr = logfile

from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import cm
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

try:
    import arabic_reshaper
    from bidi.algorithm import get_display
except Exception:
    arabic_reshaper = None
    get_display = None

ARABIC_FONT = "Helvetica"
ARABIC_FONT_BOLD = "Helvetica-Bold"
HEADING_FONT_BOLD = "Helvetica-Bold"
SESSION_FONT = "Helvetica"
SESSION_FONT_BOLD = "Helvetica-Bold"
WEEKDAY_AR = ["الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت", "الأحد"]


def _register_arabic_fonts():
    global ARABIC_FONT, ARABIC_FONT_BOLD, HEADING_FONT_BOLD, SESSION_FONT, SESSION_FONT_BOLD

    backend_dir = Path(__file__).resolve().parents[2]
    candidates = [
        backend_dir / "assets" / "fonts" / "NotoNaskhArabic-Regular.ttf",
        backend_dir / "assets" / "fonts" / "NotoSansArabic-Regular.ttf",
        Path("C:/Windows/Fonts/tahoma.ttf"),
        Path("C:/Windows/Fonts/arial.ttf"),
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
        Path("/usr/share/fonts/truetype/noto/NotoNaskhArabic-Regular.ttf"),
    ]
    bold_candidates = [
        backend_dir / "assets" / "fonts" / "NotoNaskhArabic-Bold.ttf",
        backend_dir / "assets" / "fonts" / "NotoSansArabic-Bold.ttf",
        Path("C:/Windows/Fonts/tahomabd.ttf"),
        Path("C:/Windows/Fonts/arialbd.ttf"),
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
        Path("/usr/share/fonts/truetype/noto/NotoNaskhArabic-Bold.ttf"),
    ]
    heading_candidates = [
        Path("C:/Windows/Fonts/tradbdo.ttf"),
        Path("C:/Windows/Fonts/trado.ttf"),
        Path("C:/Windows/Fonts/arialbd.ttf"),
        Path("C:/Windows/Fonts/timesbd.ttf"),
        Path("C:/Windows/Fonts/PTBoldHeading.ttf"),
        Path("C:/Windows/Fonts/ptboldheading.ttf"),
        Path("C:/Windows/Fonts/PT Bold Heading.ttf"),
        backend_dir / "assets" / "fonts" / "PTBoldHeading.ttf",
        backend_dir / "assets" / "fonts" / "ptboldheading.ttf",
    ]
    session_regular_candidates = [
        Path("C:/Windows/Fonts/trado.ttf"),
        Path("C:/Windows/Fonts/Atrado.ttf"),
        Path("C:/Windows/Fonts/BTRADO.TTF"),
        Path("C:/Windows/Fonts/tahoma.ttf"),
        backend_dir / "assets" / "fonts" / "trado.ttf",
    ]
    session_bold_candidates = [
        Path("C:/Windows/Fonts/tradbdo.ttf"),
        Path("C:/Windows/Fonts/Atradbdo.ttf"),
        Path("C:/Windows/Fonts/BTRADBDO.TTF"),
        Path("C:/Windows/Fonts/tahomabd.ttf"),
        backend_dir / "assets" / "fonts" / "tradbdo.ttf",
    ]


    regular_path = next((path for path in candidates if path.exists()), None)
    bold_path = next((path for path in bold_candidates if path.exists()), None)

    if regular_path:
        print(f"[fonts] Registering Arabic-Regular from: {regular_path}")
        if "Arabic-Regular" not in pdfmetrics.getRegisteredFontNames():
            pdfmetrics.registerFont(TTFont("Arabic-Regular", str(regular_path)))
        ARABIC_FONT = "Arabic-Regular"
    else:
        print("[fonts] No Arabic-Regular font found, fallback to Helvetica")

    if bold_path:
        print(f"[fonts] Registering Arabic-Bold from: {bold_path}")
        if "Arabic-Bold" not in pdfmetrics.getRegisteredFontNames():
            pdfmetrics.registerFont(TTFont("Arabic-Bold", str(bold_path)))
        ARABIC_FONT_BOLD = "Arabic-Bold"
    elif regular_path:
        ARABIC_FONT_BOLD = ARABIC_FONT
    else:
        print("[fonts] No Arabic-Bold font found, fallback to Helvetica-Bold")

    heading_path = next(
        (
            path
            for path in heading_candidates
            if path.exists() and (not bold_path or path.resolve() != bold_path.resolve())
        ),
        None,
    )
    if heading_path:
        if "Heading-Bold" not in pdfmetrics.getRegisteredFontNames():
            pdfmetrics.registerFont(TTFont("Heading-Bold", str(heading_path)))
        HEADING_FONT_BOLD = "Heading-Bold"
    else:
        HEADING_FONT_BOLD = ARABIC_FONT_BOLD

    session_regular_path = next((path for path in session_regular_candidates if path.exists()), None)
    session_bold_path = next((path for path in session_bold_candidates if path.exists()), None)

    if session_regular_path:
        if "Session-Regular" not in pdfmetrics.getRegisteredFontNames():
            pdfmetrics.registerFont(TTFont("Session-Regular", str(session_regular_path)))
        SESSION_FONT = "Session-Regular"
    else:
        SESSION_FONT = ARABIC_FONT

    if session_bold_path:
        if "Session-Bold" not in pdfmetrics.getRegisteredFontNames():
            pdfmetrics.registerFont(TTFont("Session-Bold", str(session_bold_path)))
        SESSION_FONT_BOLD = "Session-Bold"
    else:
        SESSION_FONT_BOLD = ARABIC_FONT_BOLD


def _ar_text(value):
    text = str(value or "")
    if not text:
        return text
    if arabic_reshaper:
        try:
            reshaped = arabic_reshaper.reshape(text)
            if get_display:
                return get_display(reshaped, base_dir="R")
            return reshaped
        except Exception:
            return text
    return text


def _draw_rtl(c, x_cm, y_pt, text):
    rendered = _ar_text(text)
    text_width = pdfmetrics.stringWidth(rendered, c._fontname, c._fontsize)
    c.drawString((x_cm * cm) - text_width, y_pt, rendered)


def _wrap_rtl_text(text, font_name, font_size, max_width_pt):
    wrapped_lines = []
    for paragraph in str(text).split("\n"):
        paragraph = paragraph.strip()
        if not paragraph:
            continue

        words = paragraph.split()
        current_line = ""

        for word in words:
            candidate = word if not current_line else f"{current_line} {word}"
            candidate_width = pdfmetrics.stringWidth(_ar_text(candidate), font_name, font_size)
            if candidate_width <= max_width_pt:
                current_line = candidate
                continue

            if current_line:
                wrapped_lines.append(current_line)
            current_line = word

        if current_line:
            wrapped_lines.append(current_line)

    return wrapped_lines


def _set_font(c, size, bold=False):
    c.setFont(ARABIC_FONT_BOLD if bold else ARABIC_FONT, size)


def _set_heading_font(c, size):
    c.setFont(HEADING_FONT_BOLD, size)


def _set_session_font(c, size, bold=False):
    c.setFont(SESSION_FONT_BOLD if bold else SESSION_FONT, size)


def _format_date_ddmmyyyy(value):
    if hasattr(value, "strftime"):
        day = f"{value.day:02d}"
        month = f"{value.month:02d}"
        year = f"{value.year:04d}"
        return f"{year}/{month}/{day}"

    text = str(value or "-").strip()
    if not text or text == "-":
        return "-"

    if "-" in text:
        parts = text.split("-")
        if len(parts) == 3 and len(parts[0]) == 4:
            year, month, day = parts
            return f"{year}/{month}/{day}"

    if "/" in text:
        parts = text.split("/")
        if len(parts) == 3 and len(parts[0]) in {1, 2}:
            year, month, day = parts
            return f"{year}/{month.zfill(2)}/{day.zfill(2)}"

    return text


def _weekday_name_ar(value):
    if hasattr(value, "weekday"):
        return WEEKDAY_AR[value.weekday()]
    return "................................"


def _format_time_hhmm(value):
    if hasattr(value, "strftime"):
        return value.strftime("%H:%M")
    return str(value or "-")


def _resolve_existing_path(paths):
    return next((path for path in paths if path.exists()), None)


def _draw_logo(c, path_obj, x_cm, y_cm, width_cm, height_cm):
    if not path_obj:
        print("[logo] No logo path provided.")
        return
    print(f"[logo] Drawing logo from: {path_obj}")
    try:
        c.drawImage(ImageReader(str(path_obj)), x_cm * cm, y_cm * cm, width=width_cm * cm, height=height_cm * cm, preserveAspectRatio=True, mask="auto")
    except Exception as e:
        print(f"[logo] Failed to draw logo from {path_obj}: {e}")


def _draw_formal_frame(c):
    c.setLineWidth(1.2)
    c.rect(1.2 * cm, 1.6 * cm, 18.6 * cm, 26.8 * cm)
    c.setLineWidth(0.6)
    c.rect(1.5 * cm, 1.9 * cm, 18.0 * cm, 26.2 * cm)


_register_arabic_fonts()


class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        self._saved_page_states.append(dict(self.__dict__))
        total_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self._draw_page_number(total_pages)
            canvas.Canvas.showPage(self)
        canvas.Canvas.save(self)

    def _draw_page_number(self, total_pages):
        page_no = self._pageNumber
        _set_font(self, 9)
        page_width = self._pagesize[0]
        self.drawCentredString(page_width / 2, 2 * cm, _ar_text(f"صفحة {page_no} من {total_pages}"))


def _page_header(c, title, metadata=None):
    _set_font(c, 14, bold=True)
    c.drawString(2 * cm, 28 * cm, _ar_text("شعار الإدارة"))
    c.drawRightString(19 * cm, 28 * cm, _ar_text("شعار الدولة"))
    c.drawCentredString(10.5 * cm, 27.2 * cm, _ar_text(title))
    if metadata:
        _set_font(c, 9)
        distribution_no = metadata.get("distribution_no", "-")
        department_name = metadata.get("department_name", "-")
        issue_date = date.today().strftime("%d/%m/%Y")
        c.drawString(2 * cm, 26.5 * cm, _ar_text(f"رقم القسمة: {distribution_no}"))
        c.drawCentredString(10.5 * cm, 26.5 * cm, _ar_text(f"الإدارة: {department_name}"))
        c.drawRightString(19 * cm, 26.5 * cm, _ar_text(f"تاريخ الإصدار: {issue_date}"))


def _attendance_header(c):
    _draw_formal_frame(c)
    backend_dir = Path(__file__).resolve().parents[2]
    backend_assets = backend_dir / "assets" / "images"
    state_logo = _resolve_existing_path([
        backend_assets / "شعار الدولة.png",
    ])
    admin_logo = _resolve_existing_path([
        backend_assets / "شعار الإدارة.png",
    ])

    _draw_logo(c, state_logo, x_cm=16.2, y_cm=24.65, width_cm=3.15, height_cm=3.15)
    _draw_logo(c, admin_logo, x_cm=1.75, y_cm=23.3, width_cm=5, height_cm=5)

    _set_heading_font(c, 24)
    c.drawCentredString(10.5 * cm, 26 * cm, _ar_text("تبليغ حضور جلسة توزيع"))
    c.setLineWidth(3)
    c.line(2 * cm, 24 * cm, 19 * cm, 24* cm)
    c.setLineWidth(1)


def _session_minutes_header(c, title, metadata=None):
    _draw_formal_frame(c)
    backend_dir = Path(__file__).resolve().parents[2]
    backend_assets = backend_dir / "assets" / "images"
    state_logo = _resolve_existing_path([
        backend_assets / "شعار الدولة.png",
    ])
    admin_logo = _resolve_existing_path([
        backend_assets / "شعار الإدارة.png",
    ])

    _draw_logo(c, state_logo, x_cm=16.2, y_cm=24.65, width_cm=3.15, height_cm=3.15)
    _draw_logo(c, admin_logo, x_cm=1.75, y_cm=23.3, width_cm=5, height_cm=5)

    _set_session_font(c, 20, bold=True)
    c.drawCentredString(10.5 * cm, 26 * cm, _ar_text(title))
    c.setLineWidth(3)
    c.line(2 * cm, 24 * cm, 19 * cm, 24 * cm)
    c.setLineWidth(1)

    if metadata:
        _set_session_font(c, 11, bold=True)
        machine_number = metadata.get("machine_number", "-")
        c.drawCentredString(10.5 * cm, 23.2 * cm, _ar_text(f"الرقم الآلي للملف: {machine_number}"))


def _justify_rtl_line(line, font_name, font_size, max_width_pt):
    words = line.split()
    if len(words) < 2:
        return line

    current_width = pdfmetrics.stringWidth(_ar_text(line), font_name, font_size)
    extra_width = max_width_pt - current_width
    if extra_width <= 0:
        return line

    space_width = pdfmetrics.stringWidth(_ar_text(" "), font_name, font_size)
    if space_width <= 0:
        return line

    gaps = len(words) - 1
    extra_spaces = int(extra_width / space_width)
    if extra_spaces <= 0:
        return line

    base = extra_spaces // gaps
    rem = extra_spaces % gaps

    parts = []
    for idx, word in enumerate(words[:-1]):
        parts.append(word)
        parts.append(" " * (1 + base + (1 if idx < rem else 0)))
    parts.append(words[-1])
    return "".join(parts)


def _draw_wrapped_text(
    c,
    text,
    x_cm,
    start_y_cm,
    max_chars=95,
    line_step_cm=0.7,
    max_lines=8,
    font_size=11,
    justify=False,
    font_name=ARABIC_FONT,
    set_font_func=_set_font,
):
    y = start_y_cm * cm
    set_font_func(c, font_size)
    max_width_pt = (19 - x_cm) * cm
    lines = _wrap_rtl_text(text, font_name, font_size, max_width_pt)
    lines_to_draw = lines[:max_lines]

    for idx, line in enumerate(lines_to_draw):
        draw_line = line
        if justify and idx < len(lines_to_draw) - 1:
            draw_line = _justify_rtl_line(line, font_name, font_size, max_width_pt)
        _draw_rtl(c, 19, y, draw_line)
        y -= line_step_cm * cm
    return y


def _draw_body_and_lines(
    c,
    body_text,
    start_y_cm,
    line_count,
    line_step_cm=0.8,
    font_size=11,
    font_name=ARABIC_FONT,
    set_font_func=_set_font,
):
    y = start_y_cm * cm
    set_font_func(c, font_size)
    used_lines = 0

    if body_text:
        body_lines = [line.strip() for line in str(body_text).split("\n")]
        for line in body_lines:
            if not line:
                continue
            wrapped = _wrap_rtl_text(line, font_name, font_size, 17 * cm)
            for wrapped_line in wrapped:
                if used_lines >= line_count:
                    break
                _draw_rtl(c, 19, y, wrapped_line)
                y -= line_step_cm * cm
                used_lines += 1
            if used_lines >= line_count:
                break

    while used_lines < line_count:
        c.drawString(2 * cm, y, "........................................................................................................................................")
        y -= line_step_cm * cm
        used_lines += 1


def _distribution_formal_header(c, distribution, page_width, page_height):
    outer_margin = 1.0 * cm
    inner_margin = 1.3 * cm

    c.setLineWidth(1.2)
    c.rect(outer_margin, outer_margin, page_width - (2 * outer_margin), page_height - (2 * outer_margin))
    c.setLineWidth(0.6)
    c.rect(inner_margin, inner_margin, page_width - (2 * inner_margin), page_height - (2 * inner_margin))

    backend_dir = Path(__file__).resolve().parents[2]
    backend_assets = backend_dir / "assets" / "images"
    state_logo = _resolve_existing_path([
        backend_assets / "شعار الدولة.png",
    ])
    admin_logo = _resolve_existing_path([
        backend_assets / "شعار الإدارة.png",
    ])

    state_logo_w = 2.8
    state_logo_h = 2.8
    admin_logo_w = 4.8
    admin_logo_h = 4.8
    logo_top_y = (page_height / cm) - 1.5

    _draw_logo(
        c,
        admin_logo,
        x_cm=1.5,
        y_cm=logo_top_y - admin_logo_h + 0.6,
        width_cm=admin_logo_w,
        height_cm=admin_logo_h,
    )
    _draw_logo(
        c,
        state_logo,
        x_cm=(page_width / cm) - 1.8 - state_logo_w,
        y_cm=logo_top_y - state_logo_h,
        width_cm=state_logo_w,
        height_cm=state_logo_h,
    )

    _set_heading_font(c, 22)
    c.drawCentredString(page_width / 2, page_height - (3 * cm), _ar_text("قائمة توزيع حصيلة تنفيذ"))

    divider_y = page_height - (4.6 * cm)
    c.setLineWidth(2.2)
    c.line(1.8 * cm, divider_y, page_width - (1.8 * cm), divider_y)
    c.setLineWidth(1)

    def draw_meta_row(y_pt, right_text, center_text, left_text):
        _set_session_font(c, 14, bold=True)
        _draw_rtl(c, (page_width / cm) - 1.8, y_pt, right_text)
        c.drawCentredString(page_width / 2, y_pt, _ar_text(center_text))
        c.drawString(1.8 * cm, y_pt, _ar_text(left_text))

    list_type_label = distribution.get_list_type_display() if hasattr(distribution, "get_list_type_display") else str(distribution.list_type or "-")
    distribution_type_label = (
        distribution.get_distribution_type_display()
        if hasattr(distribution, "get_distribution_type_display")
        else str(distribution.distribution_type or "-")
    )

    y1 = divider_y - (0.8 * cm)
    draw_meta_row(
        y1,
        f"الرقم الآلي: {getattr(distribution, 'machine_number', '-')}",
        f"نوع القائمة: {list_type_label}",
        f"الإدارة: {getattr(getattr(distribution, 'department', None), 'name', '-')}",
    )

    y2 = y1 - (0.8 * cm)
    draw_meta_row(
        y2,
        f"اسم المدين: {getattr(getattr(distribution, 'debtor', None), 'full_name', '-')}",
        f"الرقم المدني: {getattr(getattr(distribution, 'debtor', None), 'civil_id', '-')}",
        f"تاريخ القسمة: {_format_date_ddmmyyyy(getattr(distribution, 'distribution_date', '-'))}",
    )

    y3 = y2 - (0.8 * cm)
    draw_meta_row(
        y3,
        f"نوع القسمة: {distribution_type_label}",
        f"تاريخ الإيداع/البيع: {_format_date_ddmmyyyy(getattr(distribution, 'deposit_or_sale_date', '-'))}",
        f"مقدار الحصيلة: {getattr(distribution, 'proceed_amount', '-')}",
    )

    return y3 - (0.7 * cm)


def _distribution_signatures(c, page_width):
    y_line = 2.8 * cm
    c.setLineWidth(0.8)
    c.line(page_width - (10.0 * cm), y_line, page_width - (2.0 * cm), y_line)
    c.line(2.0 * cm, y_line, 10.0 * cm, y_line)

    _set_session_font(c, 16, bold=True)
    _draw_rtl(c, (page_width / cm) - 4.1, 2.2 * cm, "توقيع مأمور التنفيذ")
    _draw_rtl(c, 7.9, 2.2 * cm, "توقيع رئيس إدارة التنفيذ")


def build_distribution_pdf(distribution):
    buffer = BytesIO()
    page_size = landscape(A4)
    page_width, page_height = page_size
    c = NumberedCanvas(buffer, pagesize=page_size)

    creditors = list(distribution.creditors.all().order_by("debt_rank", "attachment_date", "id"))
    col_labels = [
        "ملاحظات",
        "مبلغ القسمة",
        "مرتبة الدين",
        "المديونية",
        "تاريخ الحجز",
        "اسم الدائن",
        "الرقم الآلي",
        "م",
    ]
    col_widths_cm = [4.1, 3.0, 2.6, 3.0, 2.8, 5.6, 3.2, 1.2]

    table_x = 1.8 * cm
    table_w = sum(width * cm for width in col_widths_cm)
    header_h = 0.95 * cm
    row_h = 0.8 * cm
    table_bottom_limit = 4.0 * cm

    def draw_table_page(start_index):
        table_top_y = _distribution_formal_header(c, distribution, page_width, page_height)

        available_height = table_top_y - table_bottom_limit
        rows_per_page = max(1, int((available_height - header_h) / row_h))
        end_index = min(start_index + rows_per_page, len(creditors))
        page_rows = creditors[start_index:end_index]

        table_height = header_h + (len(page_rows) * row_h)
        table_bottom_y = table_top_y - table_height

        c.setLineWidth(0.8)
        c.rect(table_x, table_bottom_y, table_w, table_height)

        x_edges = [table_x]
        cursor_x = table_x
        for width_cm in col_widths_cm:
            cursor_x += width_cm * cm
            x_edges.append(cursor_x)
            c.line(cursor_x, table_bottom_y, cursor_x, table_top_y)

        c.line(table_x, table_top_y - header_h, table_x + table_w, table_top_y - header_h)
        for idx in range(len(page_rows) - 1):
            row_y = table_top_y - header_h - ((idx + 1) * row_h)
            c.line(table_x, row_y, table_x + table_w, row_y)

        _set_session_font(c, 14, bold=True)
        head_y = table_top_y - (0.62 * cm)
        for idx, label in enumerate(col_labels):
            x_mid = (x_edges[idx] + x_edges[idx + 1]) / 2
            c.drawCentredString(x_mid, head_y, _ar_text(label))

        _set_session_font(c, 12)
        for local_idx, creditor in enumerate(page_rows):
            y_base = table_top_y - header_h - (local_idx * row_h)
            text_y = y_base - (0.55 * cm)

            values = [
                "",
                str(getattr(creditor, "distribution_amount", "0.000")),
                creditor.get_debt_rank_display() if hasattr(creditor, "get_debt_rank_display") else str(getattr(creditor, "debt_rank", "-")),
                str(getattr(creditor, "debt_amount", "0.000")),
                _format_date_ddmmyyyy(getattr(creditor, "attachment_date", "-")),
                str(getattr(creditor, "creditor_name", "-")),
                str(getattr(creditor, "machine_number", "-")),
                str(start_index + local_idx + 1),
            ]

            for col_idx, value in enumerate(values):
                x_left = x_edges[col_idx]
                x_right = x_edges[col_idx + 1]
                x_mid = (x_left + x_right) / 2
                if col_labels[col_idx] == "اسم الدائن":
                    _draw_rtl(c, x_right / cm - 0.1, text_y, str(value)[:45])
                else:
                    c.drawCentredString(x_mid, text_y, _ar_text(value))

        _distribution_signatures(c, page_width)
        return end_index

    current_index = 0
    while True:
        current_index = draw_table_page(current_index)
        if current_index >= len(creditors):
            break
        c.showPage()

    c.save()
    buffer.seek(0)
    return buffer


def build_attendance_notices(distribution, form_data):
    buffer = BytesIO()
    c = NumberedCanvas(buffer, pagesize=A4)
    recipients = [distribution.debtor.full_name] + [c_row.creditor_name for c_row in distribution.creditors.all()[1:]]
    first_creditor = distribution.creditors.all().first()
    applicant_name = first_creditor.creditor_name if first_creditor else "................................................"
    today_date = date.today()
    today_label = _format_date_ddmmyyyy(today_date)
    today_day = _weekday_name_ar(today_date)
    attendance_date = form_data.get("attendance_date")
    attendance_date_label = _format_date_ddmmyyyy(attendance_date)
    attendance_day = _weekday_name_ar(attendance_date)
    attendance_time = _format_time_hhmm(form_data.get("attendance_time"))
    distribution_date_label = _format_date_ddmmyyyy(getattr(distribution, "distribution_date", "-"))

    for idx, recipient in enumerate(recipients):
        _attendance_header(c)
        _set_session_font(c, 14)

        y = 22.6 * cm
        _draw_rtl(c, 19, y, f"إنه في يوم {today_day} الموافق {today_label}")
        y -= 1.0 * cm
        _draw_rtl(c, 19, y, f"بناء على طلب السيد/ {applicant_name}")
        y -= 0.9 * cm
        _draw_rtl(c, 19.45, y, "وموطنه /..........................................................................................")
        y -= 0.9 * cm
        _draw_rtl(c, 19.45, y, "انتقلت أنا/........................................................................... مأمور التنفيذ")
        y -= 0.9 * cm
        _draw_rtl(c, 19, y, f"لإعلان السيد / {recipient}")
        y -= 0.9 * cm
        _draw_rtl(c, 19.45, y, "وموطنه / ..........................................................................................")
        y -= 0.9 * cm
        _draw_rtl(c, 19.45, y, "مخاطباً مع /........................................................................................")
        y -= 1.0 * cm

        _set_heading_font(c, 24)
        c.drawCentredString(10.5 * cm, y, _ar_text("الموضوع"))
        c.line(8.1 * cm, y - (0.12 * cm), 12.9 * cm, y - (0.12 * cm))
        y -= 1.15 * cm
        _set_font(c, 14)

        y = _draw_wrapped_text(
            c,
            (
                f"لقد تم إعداد قائمة توزيع مؤقتة بتاريخ {distribution_date_label}، حصيلة التنفيذ للدائنين الحاجزين "
                f"على أموال المدين / {distribution.debtor.full_name}."
            ),
            x_cm=2,
            start_y_cm=y / cm,
            max_lines=3,
            line_step_cm=0.85,
            font_size=16,
            justify=True,
            font_name=SESSION_FONT,
            set_font_func=_set_session_font,
        )
        y -= 0.45 * cm
        _draw_rtl(c, 19, y, "وذلك بموجب المادة (282) وما بعدها من قانون المرافعات المدنية والتجارية.")
        y -= 1.0 * cm

        y = _draw_wrapped_text(
            c,
            (
                f"وقد تحدد يوم {attendance_day}، الموافق {attendance_date_label}، الساعة: {attendance_time}، "
                f"بمقر {form_data.get('location', '-')}, موعداً لانعقاد جلسة للوصول إلى تسوية ودية بشأن توزيع الحصيلة "
                "على الدائنين الحاجزين ومن اعتبر طرفاً بالإجراءات."
            ),
            x_cm=2,
            start_y_cm=y / cm,
            max_lines=4,
            line_step_cm=0.85,
            font_size=16,
            justify=True,
            font_name=SESSION_FONT,
            set_font_func=_set_session_font,
        )
        y -= 0.45 * cm
        y = _draw_wrapped_text(
            c,
            (
                f"لذلك نخطركم بضرورة الحضور بالمقر المذكور الطابق ({form_data.get('floor', '-')}) غرفة رقم ({form_data.get('room_number', '-')})، "
                "بالتاريخ والساعة المحددتين أعلاه."
            ),
            x_cm=2,
            start_y_cm=y / cm,
            max_lines=2,
            line_step_cm=0.85,
            font_size=16,
            justify=True,
            font_name=SESSION_FONT,
            set_font_func=_set_session_font,
        )
        y -= 1.0 * cm
        _draw_rtl(c, 19, y, "علماً بأن تخلفكم عن الحضور لا يمنع من إجراء التسوية الودية.")

        c.setLineWidth(0.8)
        c.line(12 * cm, 3.2 * cm, 18.8 * cm, 3.2 * cm)
        _set_session_font(c, 16, bold=True)
        _draw_rtl(c, 17, 2.6 * cm, "توقيع المستلم")
        c.line(2.2 * cm, 3.2 * cm, 9 * cm, 3.2 * cm)
        _set_session_font(c, 16, bold=True)
        _draw_rtl(c, 7, 2.6 * cm, "توقيع مأمور التنفيذ")
        if idx < len(recipients) - 1:
            c.showPage()

    c.save()
    buffer.seek(0)
    return buffer


def build_session_minutes_pdf(
    page1_body="",
    page2_body="",
    metadata=None,
    distribution=None,
    officer_name="",
    chairperson_name="",
):
    buffer = BytesIO()
    c = NumberedCanvas(buffer, pagesize=A4)
    _session_minutes_header(c, "محضر جلسة توزيع حصيلة تنفيذ", metadata)

    if distribution is not None:
        today_date = date.today()
        today_day = _weekday_name_ar(today_date)
        today_label = _format_date_ddmmyyyy(today_date)
        distribution_date_label = _format_date_ddmmyyyy(getattr(distribution, "distribution_date", "-"))
        debtor_name = getattr(getattr(distribution, "debtor", None), "full_name", "-")
        chair_name = chairperson_name.strip() or "........................"
        officer = officer_name or "........................"

        first_body = (
            f"إنه في يوم {today_day}              الموافق {today_label}                        الساعة: ...................................\n"
            f"تم انعقاد الجلسة برئاسة الأستاذ/ {chair_name}\n"
            f"وسكرتاريته السيد / {officer}                                         مأمور التنفيذ.\n"
            f"ذلك لإجراء التسوية الودية بشأن توزيع حصيلة التنفيذ التي تم تحصيلها لصالح الدائنين الحاجزين على أموال المدين / {debtor_name}\n"
            f"بموجب قائمة التوزيع المؤرخة في: {distribution_date_label}\n"
            "وقد أعلن بالحضور لهذه الجلسة كلا من المدين المحجوز لديه وكذلك الدائنين الحاجزين حيث حضر الجلسة:\n"
        )
        if page1_body.strip():
            first_body = f"{first_body}\n{page1_body.strip()}"
    else:
        first_body = page1_body 

    _draw_body_and_lines(
        c,
        first_body,
        start_y_cm=22.2,
        line_count=22,
        font_size=13,
        font_name=SESSION_FONT,
        set_font_func=_set_session_font,
    )
    _set_session_font(c, 14, bold=True)
    c.drawString(15 * cm, 3.5 * cm, _ar_text("توقيع مأمور التنفيذ"))
    c.drawRightString(6.2 * cm, 3.5 * cm, _ar_text("توقيع رئيس إدارة التنفيذ"))

    if page2_body and page2_body.strip():
        c.showPage()
        _session_minutes_header(c, "تابع محضر جلسة توزيع حصيلة تنفيذ", metadata)
        _draw_body_and_lines(
            c,
            page2_body.strip(),
            start_y_cm=22.2,
            line_count=20,
            font_size=13,
            font_name=SESSION_FONT,
            set_font_func=_set_session_font,
        )
        _set_session_font(c, 14, bold=True)
        c.drawString(15 * cm, 3.5 * cm, _ar_text("توقيع مأمور التنفيذ"))
        c.drawRightString(6.2 * cm, 3.5 * cm,_ar_text("توقيع رئيس إدارة التنفيذ"))

    c.save()
    buffer.seek(0)
    return buffer
