import os
import math
from PIL import Image, ImageDraw, ImageFont, ImageFilter

# Paths
LOGO_PATH = r"C:\Users\ADVAN\.gemini\antigravity\brain\2393933b-025f-438d-bc4f-56d8b4e362d0\.user_uploaded\media_1791623229918_db5343bf.png"
PHOTO_PATH = r"d:\YLHG\img\sample-foto-faiz.jpg"
QR_PATH = r"d:\YLHG\img\qr-kamarida.png"
TTD_PATH = r"d:\YLHG\img\ttd-kamarida-transparan.png"
OUTPUT_DIR = r"d:\YLHG\img\redesign"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Colors
NAVY_DEEP = (10, 30, 60)         # #0A1E3C
NAVY_LIGHT = (18, 52, 102)       # #123466
ROYAL_BLUE = (26, 75, 146)       # #1A4B92
CRIMSON = (220, 38, 38)          # #DC2626
EMERALD = (5, 150, 105)          # #059669
GOLD = (217, 119, 6)             # #D97706
WHITE = (255, 255, 255)
BG_LIGHT = (248, 250, 252)       # #F8FAFC
TEXT_DARK = (15, 23, 42)         # #0F172A
TEXT_MUTED = (100, 116, 139)     # #64748B
BORDER_COLOR = (226, 232, 240)   # #E2E8F0

# Load Windows Fonts
FONT_BOLD_PATH = r"C:\Windows\Fonts\segoeuib.ttf"
FONT_REG_PATH = r"C:\Windows\Fonts\segoeui.ttf"
FONT_SEMI_PATH = r"C:\Windows\Fonts\segoeuisl.ttf"

def get_font(size, bold=False):
    path = FONT_BOLD_PATH if bold else FONT_REG_PATH
    return ImageFont.truetype(path, size)

def round_rect(draw, bounds, radius, fill=None, outline=None, width=1):
    x0, y0, x1, y1 = bounds
    draw.rounded_rectangle([x0, y0, x1, y1], radius=radius, fill=fill, outline=outline, width=width)

def draw_watermark(base_img, logo_img, center_x, center_y, size=500, opacity=0.06):
    """Draw faint logo watermark in background"""
    resized_logo = logo_img.resize((size, size), Image.Resampling.LANCZOS)
    if resized_logo.mode != 'RGBA':
        resized_logo = resized_logo.convert('RGBA')
    
    # Adjust opacity
    r, g, b, a = resized_logo.split()
    a = a.point(lambda p: int(p * opacity))
    watermark = Image.merge('RGBA', (r, g, b, a))
    
    top_left_x = int(center_x - size / 2)
    top_left_y = int(center_y - size / 2)
    base_img.paste(watermark, (top_left_x, top_left_y), watermark)

def generate_model_1_master(sample_data=True):
    """
    Model 1: Modern Corporate Executive ID Card (Navy & White Prestige)
    Resolution: 1364 x 2048 (supersampled 2x)
    """
    W, H = 1364, 2048
    img = Image.new('RGBA', (W, H), (255, 255, 255, 255))
    draw = ImageDraw.Draw(img)

    # 1. Background Gradient / Tone
    for y in range(H):
        ratio = y / H
        # Subtle off-white to white
        gray = int(248 + 7 * (1 - ratio))
        draw.line([(0, y), (W, y)], fill=(gray, gray + 1, gray + 3, 255))

    # 2. Watermark Logo
    raw_logo = Image.open(LOGO_PATH)
    draw_watermark(img, raw_logo, W // 2, 950, size=750, opacity=0.065)

    # 3. Dynamic Curved Header
    # Draw smooth layered waves in header
    # Wave 1: Crimson Red Accent
    red_layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    red_draw = ImageDraw.Draw(red_layer)
    points_red = [(0, 0), (W, 0), (W, 370)]
    for x in range(W, -1, -20):
        # Sine wave
        y = 370 + int(35 * math.sin((x / W) * math.pi * 1.8 + 0.3))
        points_red.append((x, y))
    points_red.append((0, 390))
    red_draw.polygon(points_red, fill=(220, 38, 38, 255))
    img.paste(red_layer, (0, 0), red_layer)

    # Wave 2: Emerald Green Accent
    green_layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    green_draw = ImageDraw.Draw(green_layer)
    points_green = [(0, 0), (W, 0), (W, 350)]
    for x in range(W, -1, -20):
        y = 350 + int(30 * math.sin((x / W) * math.pi * 1.8 + 0.6))
        points_green.append((x, y))
    points_green.append((0, 370))
    green_draw.polygon(points_green, fill=(5, 150, 105, 255))
    img.paste(green_layer, (0, 0), green_layer)

    # Wave 3: Deep Royal Navy Main Header
    navy_layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    navy_draw = ImageDraw.Draw(navy_layer)
    points_navy = [(0, 0), (W, 0), (W, 330)]
    for x in range(W, -1, -20):
        y = 330 + int(30 * math.sin((x / W) * math.pi * 1.8 + 0.9))
        points_navy.append((x, y))
    points_navy.append((0, 350))
    
    # Fill gradient inside navy polygon
    navy_draw.polygon(points_navy, fill=(10, 30, 60, 255))
    img.paste(navy_layer, (0, 0), navy_layer)

    # 4. Header Content
    # Logo placement at top left or center top
    # Here: Centered top logo with a glowing white ring
    logo_size = 230
    logo_resized = raw_logo.resize((logo_size, logo_size), Image.Resampling.LANCZOS)
    
    logo_center_x = W // 2
    logo_center_y = 190
    
    # White circular pedestal badge for the logo
    pedestal_r = 125
    draw.ellipse([logo_center_x - pedestal_r, logo_center_y - pedestal_r,
                  logo_center_x + pedestal_r, logo_center_y + pedestal_r],
                 fill=(255, 255, 255, 255), outline=(226, 232, 240, 255), width=3)
    
    # Subtle inner accent ring
    draw.ellipse([logo_center_x - pedestal_r + 4, logo_center_y - pedestal_r + 4,
                  logo_center_x + pedestal_r - 4, logo_center_y + pedestal_r - 4],
                 outline=(10, 30, 60, 180), width=2)

    # Paste exact logo
    img.paste(logo_resized, (logo_center_x - logo_size // 2, logo_center_y - logo_size // 2), logo_resized)

    # Header Texts
    # Subtitle pill badge above or below
    # Pill "KARTU TANDA ANGGOTA"
    badge_w, badge_h = 360, 44
    badge_x = (W - badge_w) // 2
    badge_y = 335
    round_rect(draw, [badge_x, badge_y, badge_x + badge_w, badge_y + badge_h], radius=22,
               fill=(10, 30, 60, 255))
    draw.text((badge_x + badge_w // 2, badge_y + badge_h // 2), "KARTU TANDA ANGGOTA",
              font=get_font(21, bold=True), fill=(255, 255, 255), anchor="mm")

    # Yayasan Title
    draw.text((W // 2, 415), "YAYASAN LENTERA HATI GURINDAM",
              font=get_font(38, bold=True), fill=(10, 30, 60), anchor="mm")
    
    # Tagline
    draw.text((W // 2, 465), "Berbagi Cahaya, Menebar Manfaat",
              font=get_font(24, bold=False), fill=(220, 38, 38), anchor="mm")

    # Fine divider
    line_w = 400
    draw.line([(W // 2 - line_w // 2, 495), (W // 2 + line_w // 2, 495)],
              fill=(226, 232, 240), width=2)
    # Emerald center tick
    draw.line([(W // 2 - 40, 495), (W // 2 + 40, 495)],
              fill=(5, 150, 105), width=4)

    # 5. Photo Box
    photo_w, photo_h = 380, 470
    photo_x = (W - photo_w) // 2
    photo_y = 525
    photo_radius = 28

    # Outer shadow/border for photo box
    round_rect(draw, [photo_x - 6, photo_y - 6, photo_x + photo_w + 6, photo_y + photo_h + 6],
               radius=photo_radius + 4, fill=(241, 245, 249), outline=(203, 213, 225), width=2)
    round_rect(draw, [photo_x, photo_y, photo_x + photo_w, photo_y + photo_h],
               radius=photo_radius, fill=(255, 255, 255), outline=(10, 30, 60), width=3)

    if sample_data and os.path.exists(PHOTO_PATH):
        raw_photo = Image.open(PHOTO_PATH)
        # Create rounded mask
        mask = Image.new('L', (photo_w, photo_h), 0)
        mask_draw = ImageDraw.Draw(mask)
        mask_draw.rounded_rectangle([0, 0, photo_w, photo_h], radius=photo_radius, fill=255)
        
        # Cover resize
        img_ratio = raw_photo.width / raw_photo.height
        target_ratio = photo_w / photo_h
        if img_ratio > target_ratio:
            nh = raw_photo.height
            nw = int(nh * target_ratio)
            crop_box = ((raw_photo.width - nw) // 2, 0, (raw_photo.width + nw) // 2, nh)
        else:
            nw = raw_photo.width
            nh = int(nw / target_ratio)
            crop_box = (0, (raw_photo.height - nh) // 2, nw, (raw_photo.height + nh) // 2)
        cropped_p = raw_photo.crop(crop_box).resize((photo_w, photo_h), Image.Resampling.LANCZOS)
        
        photo_rgba = Image.new('RGBA', (photo_w, photo_h), (0, 0, 0, 0))
        photo_rgba.paste(cropped_p, (0, 0))
        photo_rgba.putalpha(mask)
        img.paste(photo_rgba, (photo_x, photo_y), photo_rgba)
    else:
        # Placeholder text in template
        draw.text((photo_x + photo_w // 2, photo_y + photo_h // 2 - 20), "PAS FOTO",
                  font=get_font(28, bold=True), fill=(148, 163, 184), anchor="mm")
        draw.text((photo_x + photo_w // 2, photo_y + photo_h // 2 + 25), "3 x 4 cm",
                  font=get_font(20, bold=False), fill=(148, 163, 184), anchor="mm")

    # 6. Member Data Section
    # Nama Lengkap
    nama_y = 1040
    if sample_data:
        draw.text((W // 2, nama_y), "FAIZ AL GHAZALI . H",
                  font=get_font(44, bold=True), fill=(10, 30, 60), anchor="mm")

    # Nomor Registrasi (Modern Pill Badge)
    reg_w, reg_h = 340, 52
    reg_x = (W - reg_w) // 2
    reg_y = 1085
    round_rect(draw, [reg_x, reg_y, reg_x + reg_w, reg_y + reg_h], radius=26,
               fill=(238, 242, 255), outline=(199, 210, 254), width=2)
    if sample_data:
        draw.text((reg_x + reg_w // 2, reg_y + reg_h // 2), "NO. REG : LHG-001",
                  font=get_font(25, bold=True), fill=(26, 75, 146), anchor="mm")

    # Modern Metadata Information Card
    card_w = 1140
    card_x = (W - card_w) // 2
    card_y = 1165
    card_h = 380
    round_rect(draw, [card_x, card_y, card_x + card_w, card_y + card_h], radius=24,
               fill=(255, 255, 255), outline=(226, 232, 240), width=2)
    
    # Left accent bar in card
    draw.rounded_rectangle([card_x, card_y + 16, card_x + 8, card_y + card_h - 16], radius=4,
                           fill=(10, 30, 60))

    # Field 1: ALAMAT
    row1_y = card_y + 40
    # Label
    draw.text((card_x + 40, row1_y), "ALAMAT DOMISILI",
              font=get_font(20, bold=True), fill=(100, 116, 139), anchor="lm")
    if sample_data:
        draw.text((card_x + 40, row1_y + 42), "Perm Bhumi Anggrek Residence Blok B...",
                  font=get_font(28, bold=True), fill=(15, 23, 42), anchor="lm")
        draw.text((card_x + 40, row1_y + 80), "Kota Tanjungpinang, Kepulauan Riau",
                  font=get_font(22, bold=False), fill=(71, 85, 105), anchor="lm")

    # Divider line inside card
    draw.line([(card_x + 35, card_y + 190), (card_x + card_w - 35, card_y + 190)],
              fill=(241, 245, 249), width=2)

    # Field 2: TANGGAL TERDAFTAR & STATUS ANGGOTA
    row2_y = card_y + 225
    # Column A: Tanggal Terdaftar
    draw.text((card_x + 40, row2_y), "TANGGAL TERDAFTAR",
              font=get_font(19, bold=True), fill=(100, 116, 139), anchor="lm")
    if sample_data:
        draw.text((card_x + 40, row2_y + 40), "10 Oktober 2026",
                  font=get_font(25, bold=True), fill=(15, 23, 42), anchor="lm")

    # Column B: Status
    col2_x = card_x + card_w // 2 + 50
    draw.text((col2_x, row2_y), "STATUS KEANGGOTAAN",
              font=get_font(19, bold=True), fill=(100, 116, 139), anchor="lm")
    # Green active badge is always official
    act_w, act_h = 240, 42
    round_rect(draw, [col2_x, row2_y + 20, col2_x + act_w, row2_y + 20 + act_h], radius=21,
               fill=(236, 253, 245), outline=(167, 243, 208), width=1)
    draw.text((col2_x + act_w // 2, row2_y + 20 + act_h // 2), "● ANGGOTA AKTIF",
              font=get_font(20, bold=True), fill=(5, 150, 105), anchor="mm")

    # Security Micro-note / Notice
    notice_y = 1585
    draw.text((W // 2, notice_y), "Kartu ini adalah identitas resmi anggota Yayasan Lentera Hati Gurindam.",
              font=get_font(18, bold=False), fill=(148, 163, 184), anchor="mm")
    draw.text((W // 2, notice_y + 28), "Apabila menemukan kartu ini, harap hubungi alamat sekretariat di bawah.",
              font=get_font(18, bold=False), fill=(148, 163, 184), anchor="mm")

    # 7. Modern Footer Bar (Alamat Yayasan Sesuai Permintaan User!)
    # Requirements:
    # "dibagian bawah ada alamat yayasan
    # YAYASAN LENTERA HATI GURINDAM
    # Perum Bukit Merpati 2 Blok D6 No 2
    # Tanjungpinang , Kepulauan Riau"
    
    footer_top_y = 1680
    
    # Layered Curved Accent Lines for Footer
    # Green accent wave
    g_foot = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    g_draw = ImageDraw.Draw(g_foot)
    points_g = [(0, H), (W, H), (W, footer_top_y - 30)]
    for x in range(W, -1, -20):
        y = footer_top_y - 30 - int(25 * math.sin((x / W) * math.pi * 1.5))
        points_g.append((x, y))
    points_g.append((0, footer_top_y - 10))
    g_draw.polygon(points_g, fill=(5, 150, 105, 255))
    img.paste(g_foot, (0, 0), g_foot)

    # Red accent wave
    r_foot = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    r_draw = ImageDraw.Draw(r_foot)
    points_r = [(0, H), (W, H), (W, footer_top_y - 15)]
    for x in range(W, -1, -20):
        y = footer_top_y - 15 - int(20 * math.sin((x / W) * math.pi * 1.5))
        points_r.append((x, y))
    points_r.append((0, footer_top_y + 5))
    r_draw.polygon(points_r, fill=(220, 38, 38, 255))
    img.paste(r_foot, (0, 0), r_foot)

    # Deep Navy Main Footer
    n_foot = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    n_draw = ImageDraw.Draw(n_foot)
    points_n = [(0, H), (W, H), (W, footer_top_y)]
    for x in range(W, -1, -20):
        y = footer_top_y - int(18 * math.sin((x / W) * math.pi * 1.5))
        points_n.append((x, y))
    points_n.append((0, footer_top_y + 18))
    n_draw.polygon(points_n, fill=(10, 30, 60, 255))
    img.paste(n_foot, (0, 0), n_foot)

    # Content inside Footer
    # QR Code on the right
    qr_box_size = 220
    qr_box_x = W - qr_box_size - 60
    qr_box_y = footer_top_y + 60
    
    # White rounded card for QR
    round_rect(draw, [qr_box_x, qr_box_y, qr_box_x + qr_box_size, qr_box_y + qr_box_size],
               radius=18, fill=(255, 255, 255), outline=(226, 232, 240), width=2)
    
    if os.path.exists(QR_PATH):
        qr_img = Image.open(QR_PATH).convert('RGBA').resize((180, 180), Image.Resampling.LANCZOS)
        img.paste(qr_img, (qr_box_x + 20, qr_box_y + 12), qr_img)
    
    draw.text((qr_box_x + qr_box_size // 2, qr_box_y + qr_box_size - 14), "SCAN VALIDASI",
              font=get_font(13, bold=True), fill=(10, 30, 60), anchor="mm")

    # Foundation Address on the left
    addr_x = 70
    addr_y = footer_top_y + 90
    
    # Pill label "SEKRETARIAT RESMI"
    sec_w, sec_h = 240, 36
    round_rect(draw, [addr_x, addr_y, addr_x + sec_w, addr_y + sec_h], radius=18,
               fill=(26, 75, 146))
    draw.text((addr_x + sec_w // 2, addr_y + sec_h // 2), "SEKRETARIAT RESMI",
              font=get_font(17, bold=True), fill=(255, 255, 255), anchor="mm")

    # Main Yayasan Text
    draw.text((addr_x, addr_y + 62), "YAYASAN LENTERA HATI GURINDAM",
              font=get_font(30, bold=True), fill=(255, 255, 255), anchor="lm")
    
    # Address Line 1
    draw.text((addr_x, addr_y + 106), "Perum Bukit Merpati 2 Blok D6 No 2",
              font=get_font(24, bold=False), fill=(226, 232, 240), anchor="lm")
    
    # Address Line 2
    draw.text((addr_x, addr_y + 144), "Tanjungpinang , Kepulauan Riau",
              font=get_font(24, bold=True), fill=(255, 255, 255), anchor="lm")

    # Contact line
    draw.text((addr_x, addr_y + 185), "🌐 ylhg.or.id   •   📞 0821-7227-2688",
              font=get_font(19, bold=False), fill=(203, 213, 225), anchor="lm")

    return img

def generate_model_2_master(sample_data=True):
    """
    Model 2: Modern Clean Minimalist (Sleek European / Tech Foundation Style)
    Clean white aesthetic, high readability, refined badge geometry.
    Resolution: 1364 x 2048 (supersampled 2x)
    """
    W, H = 1364, 2048
    img = Image.new('RGBA', (W, H), (255, 255, 255, 255))
    draw = ImageDraw.Draw(img)

    # 1. Background with subtle modern mesh
    for y in range(H):
        ratio = y / H
        g = int(255 - 6 * ratio)
        draw.line([(0, y), (W, y)], fill=(g, g, g + 2, 255))

    raw_logo = Image.open(LOGO_PATH)
    draw_watermark(img, raw_logo, W // 2, 1020, size=800, opacity=0.05)

    # 2. Sleek Top Bar (Dual color line)
    # Royal Navy top block
    draw.rectangle([0, 0, W, 22], fill=(10, 30, 60, 255))
    # Red accent stripe
    draw.rectangle([0, 22, W // 2, 32], fill=(220, 38, 38, 255))
    # Green accent stripe
    draw.rectangle([W // 2, 22, W, 32], fill=(5, 150, 105, 255))

    # 3. Header Section (Clean Minimalist Branding)
    logo_size = 220
    logo_resized = raw_logo.resize((logo_size, logo_size), Image.Resampling.LANCZOS)
    logo_x = (W - logo_size) // 2
    logo_y = 65
    img.paste(logo_resized, (logo_x, logo_y), logo_resized)

    # Pill "KARTU TANDA ANGGOTA"
    draw.text((W // 2, 325), "KARTU TANDA ANGGOTA",
              font=get_font(22, bold=True), fill=(100, 116, 139), anchor="mm")

    # Title
    draw.text((W // 2, 375), "YAYASAN LENTERA HATI GURINDAM",
              font=get_font(38, bold=True), fill=(10, 30, 60), anchor="mm")
    
    # Subtitle / Tagline
    draw.text((W // 2, 420), "Berbagi Cahaya, Menebar Manfaat",
              font=get_font(23, bold=False), fill=(220, 38, 38), anchor="mm")

    # Subtle horizontal line
    draw.line([(100, 455), (W - 100, 455)], fill=(226, 232, 240), width=2)
    # Emerald center accent
    draw.line([(W // 2 - 50, 455), (W // 2 + 50, 455)], fill=(5, 150, 105), width=4)

    # 4. Photo Frame (Clean Floating Card)
    photo_w, photo_h = 390, 480
    photo_x = (W - photo_w) // 2
    photo_y = 490
    photo_radius = 24

    # Card border with subtle double-ring
    round_rect(draw, [photo_x - 6, photo_y - 6, photo_x + photo_w + 6, photo_y + photo_h + 6],
               radius=photo_radius + 4, fill=(248, 250, 252), outline=(203, 213, 225), width=2)
    round_rect(draw, [photo_x, photo_y, photo_x + photo_w, photo_y + photo_h],
               radius=photo_radius, fill=(255, 255, 255), outline=(10, 30, 60), width=3)

    if sample_data and os.path.exists(PHOTO_PATH):
        raw_photo = Image.open(PHOTO_PATH)
        mask = Image.new('L', (photo_w, photo_h), 0)
        mask_draw = ImageDraw.Draw(mask)
        mask_draw.rounded_rectangle([0, 0, photo_w, photo_h], radius=photo_radius, fill=255)
        
        img_ratio = raw_photo.width / raw_photo.height
        target_ratio = photo_w / photo_h
        if img_ratio > target_ratio:
            nh = raw_photo.height
            nw = int(nh * target_ratio)
            crop_box = ((raw_photo.width - nw) // 2, 0, (raw_photo.width + nw) // 2, nh)
        else:
            nw = raw_photo.width
            nh = int(nw / target_ratio)
            crop_box = (0, (raw_photo.height - nh) // 2, nw, (raw_photo.height + nh) // 2)
        cropped_p = raw_photo.crop(crop_box).resize((photo_w, photo_h), Image.Resampling.LANCZOS)
        
        photo_rgba = Image.new('RGBA', (photo_w, photo_h), (0, 0, 0, 0))
        photo_rgba.paste(cropped_p, (0, 0))
        photo_rgba.putalpha(mask)
        img.paste(photo_rgba, (photo_x, photo_y), photo_rgba)
    else:
        draw.text((photo_x + photo_w // 2, photo_y + photo_h // 2), "PAS FOTO",
                  font=get_font(28, bold=True), fill=(148, 163, 184), anchor="mm")

    # 5. Member Identity & Data
    nama_y = 1015
    if sample_data:
        draw.text((W // 2, nama_y), "FAIZ AL GHAZALI . H",
                  font=get_font(44, bold=True), fill=(10, 30, 60), anchor="mm")

    # Modern registration badge
    reg_w, reg_h = 360, 52
    reg_x = (W - reg_w) // 2
    reg_y = 1060
    round_rect(draw, [reg_x, reg_y, reg_x + reg_w, reg_y + reg_h], radius=26,
               fill=(10, 30, 60), outline=(10, 30, 60), width=1)
    if sample_data:
        draw.text((reg_x + reg_w // 2, reg_y + reg_h // 2), "NO. REG : LHG-001",
                  font=get_font(24, bold=True), fill=(255, 255, 255), anchor="mm")

    # Clean Modern Minimalist Data Block (Grid / Box Layout)
    box_w = 1160
    box_x = (W - box_w) // 2
    box_y = 1145
    box_h = 420
    round_rect(draw, [box_x, box_y, box_x + box_w, box_y + box_h], radius=20,
               fill=(255, 255, 255), outline=(226, 232, 240), width=2)

    # Item 1: ALAMAT
    item1_y = box_y + 40
    # Subtle modern icon badge
    round_rect(draw, [box_x + 35, item1_y - 10, box_x + 85, item1_y + 40], radius=12,
               fill=(238, 242, 255))
    draw.text((box_x + 60, item1_y + 15), "📍", font=get_font(22), anchor="mm")
    
    draw.text((box_x + 105, item1_y - 2), "ALAMAT LENGKAP ANGGOTA",
              font=get_font(18, bold=True), fill=(100, 116, 139), anchor="lm")
    if sample_data:
        draw.text((box_x + 105, item1_y + 35), "Perm Bhumi Anggrek Residence Blok B...",
                  font=get_font(27, bold=True), fill=(15, 23, 42), anchor="lm")
        draw.text((box_x + 105, item1_y + 70), "Tanjungpinang, Kepulauan Riau",
                  font=get_font(22, bold=False), fill=(71, 85, 105), anchor="lm")

    # Divider
    draw.line([(box_x + 35, box_y + 185), (box_x + box_w - 35, box_y + 185)],
              fill=(241, 245, 249), width=2)

    # Item 2: TANGGAL TERDAFTAR
    item2_y = box_y + 225
    round_rect(draw, [box_x + 35, item2_y - 10, box_x + 85, item2_y + 40], radius=12,
               fill=(236, 253, 245))
    draw.text((box_x + 60, item2_y + 15), "📅", font=get_font(22), anchor="mm")

    draw.text((box_x + 105, item2_y - 2), "TANGGAL TERDAFTAR",
              font=get_font(18, bold=True), fill=(100, 116, 139), anchor="lm")
    if sample_data:
        draw.text((box_x + 105, item2_y + 35), "10 Oktober 2026",
                  font=get_font(25, bold=True), fill=(15, 23, 42), anchor="lm")

    # Column 2: Status
    item2_col2 = box_x + 620
    round_rect(draw, [item2_col2, item2_y - 10, item2_col2 + 50, item2_y + 40], radius=12,
               fill=(254, 243, 199))
    draw.text((item2_col2 + 25, item2_y + 15), "🛡️", font=get_font(22), anchor="mm")

    draw.text((item2_col2 + 70, item2_y - 2), "STATUS VERIFIKASI",
              font=get_font(18, bold=True), fill=(100, 116, 139), anchor="lm")
    draw.text((item2_col2 + 70, item2_y + 35), "Terdaftar & Terverifikasi",
              font=get_font(24, bold=True), fill=(5, 150, 105), anchor="lm")

    # Bottom notice
    draw.text((W // 2, box_y + box_h + 40), "Dokumen Resmi ID Card Yayasan Lentera Hati Gurindam",
              font=get_font(19, bold=False), fill=(148, 163, 184), anchor="mm")

    # 6. Bottom Address Bar (Foundation Address)
    # User requirement:
    # YAYASAN LENTERA HATI GURINDAM
    # Perum Bukit Merpati 2 Blok D6 No 2
    # Tanjungpinang , Kepulauan Riau
    f_box_h = 320
    f_box_y = H - f_box_h
    # Clean Dark Container with Top Accent Border
    draw.rectangle([0, f_box_y, W, H], fill=(10, 30, 60))
    # Double accent line
    draw.rectangle([0, f_box_y, W // 2, f_box_y + 6], fill=(220, 38, 38))
    draw.rectangle([W // 2, f_box_y, W, f_box_y + 6], fill=(5, 150, 105))

    # QR Code Box
    qr_s = 200
    qr_x = W - qr_s - 65
    qr_y = f_box_y + 55
    round_rect(draw, [qr_x, qr_y, qr_x + qr_s, qr_y + qr_s], radius=16,
               fill=(255, 255, 255))
    if os.path.exists(QR_PATH):
        qr_img = Image.open(QR_PATH).convert('RGBA').resize((165, 165), Image.Resampling.LANCZOS)
        img.paste(qr_img, (qr_x + 17, qr_y + 10), qr_img)
    draw.text((qr_x + qr_s // 2, qr_y + qr_s - 12), "VALIDASI DIGITAL",
              font=get_font(12, bold=True), fill=(10, 30, 60), anchor="mm")

    # Foundation Address Details
    fa_x = 75
    fa_y = f_box_y + 70
    draw.text((fa_x, fa_y), "YAYASAN LENTERA HATI GURINDAM",
              font=get_font(32, bold=True), fill=(255, 255, 255), anchor="lm")
    draw.text((fa_x, fa_y + 48), "Perum Bukit Merpati 2 Blok D6 No 2",
              font=get_font(25, bold=False), fill=(226, 232, 240), anchor="lm")
    draw.text((fa_x, fa_y + 88), "Tanjungpinang , Kepulauan Riau",
              font=get_font(25, bold=True), fill=(255, 255, 255), anchor="lm")
    draw.text((fa_x, fa_y + 130), "Website: ylhg.or.id   |   WhatsApp: 0821-7227-2688",
              font=get_font(20, bold=False), fill=(203, 213, 225), anchor="lm")

    return img

def generate_model_3_master(sample_data=True):
    """
    Model 3: Modern Dynamic Curved Ribbon (Contemporary Flowing Theme)
    Incorporating subtle fluid gradient arcs, prominent logo, and high visual contrast.
    Resolution: 1364 x 2048 (supersampled 2x)
    """
    W, H = 1364, 2048
    img = Image.new('RGBA', (W, H), (255, 255, 255, 255))
    draw = ImageDraw.Draw(img)

    for y in range(H):
        ratio = y / H
        g = int(250 + 5 * (1 - ratio))
        draw.line([(0, y), (W, y)], fill=(g, g + 2, g + 4, 255))

    raw_logo = Image.open(LOGO_PATH)
    draw_watermark(img, raw_logo, W // 2, 980, size=750, opacity=0.06)

    # Dynamic Asymmetrical Curved Header
    # Layer 1: Crimson Red
    red_layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    red_draw = ImageDraw.Draw(red_layer)
    red_draw.polygon([(0, 0), (W, 0), (W, 360), (0, 430)], fill=(220, 38, 38, 255))
    img.paste(red_layer, (0, 0), red_layer)

    # Layer 2: Emerald Green Accent Strip
    green_layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    green_draw = ImageDraw.Draw(green_layer)
    green_draw.polygon([(0, 0), (W, 0), (W, 335), (0, 405)], fill=(5, 150, 105, 255))
    img.paste(green_layer, (0, 0), green_layer)

    # Layer 3: Deep Royal Navy Header
    navy_layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    navy_draw = ImageDraw.Draw(navy_layer)
    navy_draw.polygon([(0, 0), (W, 0), (W, 310), (0, 375)], fill=(10, 30, 60, 255))
    img.paste(navy_layer, (0, 0), navy_layer)

    # Circular Logo with White Shield
    logo_size = 230
    logo_resized = raw_logo.resize((logo_size, logo_size), Image.Resampling.LANCZOS)
    logo_x = (W - logo_size) // 2
    logo_y = 100
    
    # White circle behind logo
    draw.ellipse([logo_x - 12, logo_y - 12, logo_x + logo_size + 12, logo_y + logo_size + 12],
                 fill=(255, 255, 255), outline=(226, 232, 240), width=4)
    img.paste(logo_resized, (logo_x, logo_y), logo_resized)

    # Header Titles Below Logo
    draw.text((W // 2, 380), "YAYASAN LENTERA HATI GURINDAM",
              font=get_font(38, bold=True), fill=(10, 30, 60), anchor="mm")
    
    # Pill "KARTU TANDA ANGGOTA"
    badge_w, badge_h = 320, 40
    badge_x = (W - badge_w) // 2
    badge_y = 425
    round_rect(draw, [badge_x, badge_y, badge_x + badge_w, badge_y + badge_h], radius=20,
               fill=(220, 38, 38))
    draw.text((badge_x + badge_w // 2, badge_y + badge_h // 2), "KARTU TANDA ANGGOTA",
              font=get_font(20, bold=True), fill=(255, 255, 255), anchor="mm")

    draw.text((W // 2, 495), "Berbagi Cahaya, Menebar Manfaat",
              font=get_font(23, bold=False), fill=(100, 116, 139), anchor="mm")

    # Photo Box
    photo_w, photo_h = 380, 470
    photo_x = (W - photo_w) // 2
    photo_y = 535
    photo_radius = 26

    round_rect(draw, [photo_x - 6, photo_y - 6, photo_x + photo_w + 6, photo_y + photo_h + 6],
               radius=photo_radius + 4, fill=(241, 245, 249), outline=(203, 213, 225), width=2)
    round_rect(draw, [photo_x, photo_y, photo_x + photo_w, photo_y + photo_h],
               radius=photo_radius, fill=(255, 255, 255), outline=(10, 30, 60), width=3)

    if sample_data and os.path.exists(PHOTO_PATH):
        raw_photo = Image.open(PHOTO_PATH)
        mask = Image.new('L', (photo_w, photo_h), 0)
        mask_draw = ImageDraw.Draw(mask)
        mask_draw.rounded_rectangle([0, 0, photo_w, photo_h], radius=photo_radius, fill=255)
        
        img_ratio = raw_photo.width / raw_photo.height
        target_ratio = photo_w / photo_h
        if img_ratio > target_ratio:
            nh = raw_photo.height
            nw = int(nh * target_ratio)
            crop_box = ((raw_photo.width - nw) // 2, 0, (raw_photo.width + nw) // 2, nh)
        else:
            nw = raw_photo.width
            nh = int(nw / target_ratio)
            crop_box = (0, (raw_photo.height - nh) // 2, nw, (raw_photo.height + nh) // 2)
        cropped_p = raw_photo.crop(crop_box).resize((photo_w, photo_h), Image.Resampling.LANCZOS)
        
        photo_rgba = Image.new('RGBA', (photo_w, photo_h), (0, 0, 0, 0))
        photo_rgba.paste(cropped_p, (0, 0))
        photo_rgba.putalpha(mask)
        img.paste(photo_rgba, (photo_x, photo_y), photo_rgba)
    else:
        draw.text((photo_x + photo_w // 2, photo_y + photo_h // 2), "PAS FOTO",
                  font=get_font(28, bold=True), fill=(148, 163, 184), anchor="mm")

    # Member Name & Badge
    nama_y = 1050
    if sample_data:
        draw.text((W // 2, nama_y), "FAIZ AL GHAZALI . H",
                  font=get_font(44, bold=True), fill=(10, 30, 60), anchor="mm")

    reg_w, reg_h = 340, 50
    reg_x = (W - reg_w) // 2
    reg_y = 1095
    round_rect(draw, [reg_x, reg_y, reg_x + reg_w, reg_y + reg_h], radius=25,
               fill=(5, 150, 105), outline=(5, 150, 105))
    if sample_data:
        draw.text((reg_x + reg_w // 2, reg_y + reg_h // 2), "NO. REG : LHG-001",
                  font=get_font(24, bold=True), fill=(255, 255, 255), anchor="mm")

    # Information Card
    card_w = 1140
    card_x = (W - card_w) // 2
    card_y = 1175
    card_h = 380
    round_rect(draw, [card_x, card_y, card_x + card_w, card_y + card_h], radius=22,
               fill=(255, 255, 255), outline=(226, 232, 240), width=2)
    
    # Left accent
    draw.rounded_rectangle([card_x, card_y + 15, card_x + 8, card_y + card_h - 15], radius=4,
                           fill=(5, 150, 105))

    # Field 1: ALAMAT
    row1_y = card_y + 40
    draw.text((card_x + 40, row1_y), "ALAMAT LENGKAP",
              font=get_font(20, bold=True), fill=(100, 116, 139), anchor="lm")
    if sample_data:
        draw.text((card_x + 40, row1_y + 42), "Perm Bhumi Anggrek Residence Blok B...",
                  font=get_font(28, bold=True), fill=(15, 23, 42), anchor="lm")
        draw.text((card_x + 40, row1_y + 80), "Kota Tanjungpinang, Kepulauan Riau",
                  font=get_font(22, bold=False), fill=(71, 85, 105), anchor="lm")

    draw.line([(card_x + 35, card_y + 190), (card_x + card_w - 35, card_y + 190)],
              fill=(241, 245, 249), width=2)

    # Field 2: TANGGAL & STATUS
    row2_y = card_y + 225
    draw.text((card_x + 40, row2_y), "TANGGAL TERDAFTAR",
              font=get_font(19, bold=True), fill=(100, 116, 139), anchor="lm")
    if sample_data:
        draw.text((card_x + 40, row2_y + 40), "10 Oktober 2026",
                  font=get_font(25, bold=True), fill=(15, 23, 42), anchor="lm")

    col2_x = card_x + card_w // 2 + 50
    draw.text((col2_x, row2_y), "DISABILITAS / KATEGORI",
              font=get_font(19, bold=True), fill=(100, 116, 139), anchor="lm")
    draw.text((col2_x, row2_y + 40), "Anggota Binaan Yayasan",
              font=get_font(24, bold=True), fill=(26, 75, 146), anchor="lm")

    # Bottom Footer
    foot_y = 1680
    # Angled footer bands
    g_foot = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    g_draw = ImageDraw.Draw(g_foot)
    g_draw.polygon([(0, foot_y - 25), (W, foot_y + 35), (W, H), (0, H)], fill=(5, 150, 105, 255))
    img.paste(g_foot, (0, 0), g_foot)

    r_foot = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    r_draw = ImageDraw.Draw(r_foot)
    r_draw.polygon([(0, foot_y - 10), (W, foot_y + 50), (W, H), (0, H)], fill=(220, 38, 38, 255))
    img.paste(r_foot, (0, 0), r_foot)

    n_foot = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    n_draw = ImageDraw.Draw(n_foot)
    n_draw.polygon([(0, foot_y + 10), (W, foot_y + 70), (W, H), (0, H)], fill=(10, 30, 60, 255))
    img.paste(n_foot, (0, 0), n_foot)

    # Footer Content
    qr_s = 210
    qr_x = W - qr_s - 60
    qr_y = foot_y + 90
    round_rect(draw, [qr_x, qr_y, qr_x + qr_s, qr_y + qr_s], radius=18,
               fill=(255, 255, 255))
    if os.path.exists(QR_PATH):
        qr_img = Image.open(QR_PATH).convert('RGBA').resize((170, 170), Image.Resampling.LANCZOS)
        img.paste(qr_img, (qr_x + 20, qr_y + 10), qr_img)
    draw.text((qr_x + qr_s // 2, qr_y + qr_s - 14), "VALIDASI RESMI",
              font=get_font(12, bold=True), fill=(10, 30, 60), anchor="mm")

    fa_x = 70
    fa_y = foot_y + 110
    draw.text((fa_x, fa_y), "YAYASAN LENTERA HATI GURINDAM",
              font=get_font(31, bold=True), fill=(255, 255, 255), anchor="lm")
    draw.text((fa_x, fa_y + 46), "Perum Bukit Merpati 2 Blok D6 No 2",
              font=get_font(24, bold=False), fill=(226, 232, 240), anchor="lm")
    draw.text((fa_x, fa_y + 86), "Tanjungpinang , Kepulauan Riau",
              font=get_font(24, bold=True), fill=(255, 255, 255), anchor="lm")
    draw.text((fa_x, fa_y + 128), "Komitmen Membantu Sesama • Pelayanan Inklusif",
              font=get_font(19, bold=False), fill=(203, 213, 225), anchor="lm")

    return img

def generate_back_card_master():
    """
    Sisi Belakang ID Card (Back Side)
    Memuat Ketentuan, Visi Misi, Tanda Tangan Digital Ketua Yayasan (Kamarida, S.Pd),
    Cap Resmi Yayasan, QR Code, dan Alamat Lengkap Yayasan.
    Resolution: 1364 x 2048 (supersampled 2x)
    """
    W, H = 1364, 2048
    img = Image.new('RGBA', (W, H), (255, 255, 255, 255))
    draw = ImageDraw.Draw(img)

    for y in range(H):
        ratio = y / H
        g = int(248 + 7 * (1 - ratio))
        draw.line([(0, y), (W, y)], fill=(g, g + 1, g + 3, 255))

    raw_logo = Image.open(LOGO_PATH)
    draw_watermark(img, raw_logo, W // 2, H // 2, size=900, opacity=0.06)

    # Top Header
    draw.rectangle([0, 0, W, 180], fill=(10, 30, 60))
    draw.rectangle([0, 180, W // 2, 188], fill=(220, 38, 38))
    draw.rectangle([W // 2, 180, W, 188], fill=(5, 150, 105))

    # Header Logo & Title
    logo_mini = raw_logo.resize((120, 120), Image.Resampling.LANCZOS)
    img.paste(logo_mini, (70, 30), logo_mini)
    
    draw.text((220, 70), "YAYASAN LENTERA HATI GURINDAM",
              font=get_font(32, bold=True), fill=(255, 255, 255), anchor="lm")
    draw.text((220, 115), "KETENTUAN & LEGALITAS KARTU TANDA ANGGOTA (KTA)",
              font=get_font(20, bold=False), fill=(203, 213, 225), anchor="lm")

    # Content Container
    box_w = 1200
    box_x = (W - box_w) // 2
    box_y = 230

    # Section 1: Ketentuan Pemegang Kartu
    draw.text((box_x + 10, box_y + 20), "KETENTUAN PENGGUNAAN KARTU",
              font=get_font(26, bold=True), fill=(10, 30, 60), anchor="lm")
    draw.line([(box_x + 10, box_y + 45), (box_x + 450, box_y + 45)],
              fill=(5, 150, 105), width=3)

    rules = [
        "1. Kartu ini adalah bukti keanggotaan sah pada Yayasan Lentera Hati Gurindam.",
        "2. Kartu ini tidak dapat dipindahtangankan kepada pihak lain yang tidak berhak.",
        "3. Berhak mendapatkan pendampingan sosial, pelatihan, dan layanan yayasan.",
        "4. Apabila kartu ini hilang atau rusak, segera melapor ke pihak sekretariat yayasan.",
        "5. Barang siapa menemukan kartu ini, mohon kesediaannya untuk mengembalikan ke",
        "    alamat sekretariat resmi yang tertera di bawah ini."
    ]
    cur_y = box_y + 85
    for r in rules:
        draw.text((box_x + 15, cur_y), r,
                  font=get_font(23, bold=False), fill=(51, 65, 85), anchor="lm")
        cur_y += 44

    # Section 2: Visi & Misi Yayasan
    cur_y += 35
    draw.text((box_x + 10, cur_y), "VISI & MOTTO YAYASAN",
              font=get_font(26, bold=True), fill=(10, 30, 60), anchor="lm")
    draw.line([(box_x + 10, cur_y + 25), (box_x + 380, cur_y + 25)],
              fill=(220, 38, 38), width=3)

    cur_y += 65
    draw.text((box_x + 15, cur_y), "“ Berbagi Cahaya, Menebar Manfaat Menuju Masyarakat Mandiri & Inklusif ”",
              font=get_font(25, bold=True), fill=(26, 75, 146), anchor="lm")
    cur_y += 42
    draw.text((box_x + 15, cur_y), "Mewujudkan perlindungan sosial, advokasi, dan pengembangan potensi bagi anak-anak",
              font=get_font(22, bold=False), fill=(71, 85, 105), anchor="lm")
    cur_y += 36
    draw.text((box_x + 15, cur_y), "dan masyarakat disabilitas di Tanjungpinang dan Kepulauan Riau.",
              font=get_font(22, bold=False), fill=(71, 85, 105), anchor="lm")

    # Section 3: Legalitas & Pengesahan (Signature & Stamp)
    cur_y += 60
    round_rect(draw, [box_x, cur_y, box_x + box_w, cur_y + 440], radius=20,
               fill=(248, 250, 252), outline=(226, 232, 240), width=2)
    
    # Left side: Legalitas Menkumham
    draw.text((box_x + 40, cur_y + 45), "LEGALITAS RESMI YAYASAN",
              font=get_font(22, bold=True), fill=(10, 30, 60), anchor="lm")
    draw.text((box_x + 40, cur_y + 88), "• Akta Notaris Pendirian Yayasan",
              font=get_font(21, bold=False), fill=(71, 85, 105), anchor="lm")
    draw.text((box_x + 40, cur_y + 128), "• SK Kemenkumham RI Terdaftar",
              font=get_font(21, bold=False), fill=(71, 85, 105), anchor="lm")
    draw.text((box_x + 40, cur_y + 168), "• NPWP & NIB Terverifikasi",
              font=get_font(21, bold=False), fill=(71, 85, 105), anchor="lm")
    draw.text((box_x + 40, cur_y + 208), "• Terdaftar di Dinas Sosial Kota Tanjungpinang",
              font=get_font(21, bold=False), fill=(71, 85, 105), anchor="lm")

    # Barcode representation
    bar_x = box_x + 40
    bar_y = cur_y + 270
    round_rect(draw, [bar_x, bar_y, bar_x + 460, bar_y + 90], radius=10,
               fill=(255, 255, 255), outline=(203, 213, 225), width=1)
    draw.text((bar_x + 230, bar_y + 35), "||| | ||||| || |||| |||| | ||||||| ||| |||",
              font=get_font(30, bold=True), fill=(15, 23, 42), anchor="mm")
    draw.text((bar_x + 230, bar_y + 70), "LHG - KTA - 2026 - OFFICIAL",
              font=get_font(15, bold=True), fill=(100, 116, 139), anchor="mm")

    # Right side: Tanda Tangan Ketua Yayasan
    ttd_center_x = box_x + box_w - 280
    draw.text((ttd_center_x, cur_y + 45), "Tanjungpinang, Kepulauan Riau",
              font=get_font(20, bold=False), fill=(71, 85, 105), anchor="mm")
    draw.text((ttd_center_x, cur_y + 80), "Ketua Yayasan,",
              font=get_font(22, bold=True), fill=(10, 30, 60), anchor="mm")

    # Paste signature
    if os.path.exists(TTD_PATH):
        ttd_img = Image.open(TTD_PATH).convert('RGBA')
        ttd_img = ttd_img.resize((320, 160), Image.Resampling.LANCZOS)
        img.paste(ttd_img, (ttd_center_x - 160, cur_y + 100), ttd_img)

    # Stamp overlay / badge
    draw.ellipse([ttd_center_x - 140, cur_y + 115, ttd_center_x - 20, cur_y + 235],
                 outline=(220, 38, 38, 140), width=3)
    draw.text((ttd_center_x - 80, cur_y + 175), "STEMPEL\nRESMI",
              font=get_font(13, bold=True), fill=(220, 38, 38, 160), anchor="mm")

    draw.text((ttd_center_x, cur_y + 290), "KAMARIDA, S.Pd",
              font=get_font(24, bold=True), fill=(10, 30, 60), anchor="mm")
    draw.text((ttd_center_x, cur_y + 325), "NIP / ID: LHG-DIR-01",
              font=get_font(18, bold=False), fill=(100, 116, 139), anchor="mm")

    # 4. Bottom Footer (Foundation Address)
    foot_h = 320
    foot_y = H - foot_h
    draw.rectangle([0, foot_y, W, H], fill=(10, 30, 60))
    draw.rectangle([0, foot_y, W // 2, foot_y + 6], fill=(220, 38, 38))
    draw.rectangle([W // 2, foot_y, W, foot_y + 6], fill=(5, 150, 105))

    # QR Code on right
    qr_s = 200
    qr_x = W - qr_s - 65
    qr_y = foot_y + 55
    round_rect(draw, [qr_x, qr_y, qr_x + qr_s, qr_y + qr_s], radius=16,
               fill=(255, 255, 255))
    if os.path.exists(QR_PATH):
        qr_img = Image.open(QR_PATH).convert('RGBA').resize((165, 165), Image.Resampling.LANCZOS)
        img.paste(qr_img, (qr_x + 17, qr_y + 10), qr_img)
    draw.text((qr_x + qr_s // 2, qr_y + qr_s - 12), "VERIFIKASI RESMI",
              font=get_font(12, bold=True), fill=(10, 30, 60), anchor="mm")

    # Address Details on left
    fa_x = 75
    fa_y = foot_y + 70
    draw.text((fa_x, fa_y), "YAYASAN LENTERA HATI GURINDAM",
              font=get_font(32, bold=True), fill=(255, 255, 255), anchor="lm")
    draw.text((fa_x, fa_y + 48), "Perum Bukit Merpati 2 Blok D6 No 2",
              font=get_font(25, bold=False), fill=(226, 232, 240), anchor="lm")
    draw.text((fa_x, fa_y + 88), "Tanjungpinang , Kepulauan Riau",
              font=get_font(25, bold=True), fill=(255, 255, 255), anchor="lm")
    draw.text((fa_x, fa_y + 130), "Website: ylhg.or.id   |   Email: sekretariat@ylhg.or.id",
              font=get_font(20, bold=False), fill=(203, 213, 225), anchor="lm")

    return img

print("Generating all models and templates...")

# Model 1
m1_sample = generate_model_1_master(sample_data=True)
m1_sample.save(os.path.join(OUTPUT_DIR, "model_1_sample_2x.png"))
m1_sample_1x = m1_sample.resize((682, 1024), Image.Resampling.LANCZOS)
m1_sample_1x.save(os.path.join(OUTPUT_DIR, "model_1_sample_preview_682x1024.png"))
m1_sample_1x.convert('RGB').save(os.path.join(OUTPUT_DIR, "model_1_sample_preview_682x1024.jpg"), quality=96)

m1_blank = generate_model_1_master(sample_data=False)
m1_blank_1x = m1_blank.resize((682, 1024), Image.Resampling.LANCZOS)
m1_blank_1x.convert('RGB').save(os.path.join(OUTPUT_DIR, "model_1_blank_template_682x1024.jpg"), quality=96)
m1_blank_1x.save(os.path.join(OUTPUT_DIR, "model_1_blank_template_682x1024.png"))

# Model 2
m2_sample = generate_model_2_master(sample_data=True)
m2_sample.save(os.path.join(OUTPUT_DIR, "model_2_sample_2x.png"))
m2_sample_1x = m2_sample.resize((682, 1024), Image.Resampling.LANCZOS)
m2_sample_1x.save(os.path.join(OUTPUT_DIR, "model_2_sample_preview_682x1024.png"))
m2_sample_1x.convert('RGB').save(os.path.join(OUTPUT_DIR, "model_2_sample_preview_682x1024.jpg"), quality=96)

m2_blank = generate_model_2_master(sample_data=False)
m2_blank_1x = m2_blank.resize((682, 1024), Image.Resampling.LANCZOS)
m2_blank_1x.convert('RGB').save(os.path.join(OUTPUT_DIR, "model_2_blank_template_682x1024.jpg"), quality=96)
m2_blank_1x.save(os.path.join(OUTPUT_DIR, "model_2_blank_template_682x1024.png"))

# Model 3
m3_sample = generate_model_3_master(sample_data=True)
m3_sample.save(os.path.join(OUTPUT_DIR, "model_3_sample_2x.png"))
m3_sample_1x = m3_sample.resize((682, 1024), Image.Resampling.LANCZOS)
m3_sample_1x.save(os.path.join(OUTPUT_DIR, "model_3_sample_preview_682x1024.png"))
m3_sample_1x.convert('RGB').save(os.path.join(OUTPUT_DIR, "model_3_sample_preview_682x1024.jpg"), quality=96)

m3_blank = generate_model_3_master(sample_data=False)
m3_blank_1x = m3_blank.resize((682, 1024), Image.Resampling.LANCZOS)
m3_blank_1x.convert('RGB').save(os.path.join(OUTPUT_DIR, "model_3_blank_template_682x1024.jpg"), quality=96)
m3_blank_1x.save(os.path.join(OUTPUT_DIR, "model_3_blank_template_682x1024.png"))

# Back side
back_sample = generate_back_card_master()
back_sample.save(os.path.join(OUTPUT_DIR, "card_back_side_2x.png"))
back_sample_1x = back_sample.resize((682, 1024), Image.Resampling.LANCZOS)
back_sample_1x.save(os.path.join(OUTPUT_DIR, "card_back_side_preview_682x1024.png"))
back_sample_1x.convert('RGB').save(os.path.join(OUTPUT_DIR, "card_back_side_682x1024.jpg"), quality=96)

print("All models successfully generated and saved to:", OUTPUT_DIR)

