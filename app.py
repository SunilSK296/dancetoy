import streamlit as st
import cv2
import numpy as np
import easyocr
from PIL import Image, ImageChops, ImageEnhance
from pdf2image import convert_from_path
import tempfile
import os

# ------------------------------
# LOAD OCR (cached)
# ------------------------------
@st.cache_resource
def load_ocr():
    return easyocr.Reader(['en','hi'], gpu=False)

reader = load_ocr()

# ------------------------------
# ELA FUNCTION
# ------------------------------
def perform_ela(image_path, quality=90):
    original = Image.open(image_path).convert('RGB')

    with tempfile.NamedTemporaryFile(suffix='.jpg') as tmp:
        original.save(tmp.name, 'JPEG', quality=quality)
        resaved = Image.open(tmp.name)

        diff = ImageChops.difference(original, resaved)

        extrema = diff.getextrema()
        max_diff = max([ex[1] for ex in extrema]) or 1

        scale = 255.0 / max_diff
        ela_img = ImageEnhance.Brightness(diff).enhance(scale)

    return ela_img

# ------------------------------
# FIND SUSPICIOUS REGIONS
# ------------------------------
def get_suspicious_regions(ela_img):
    img = np.array(ela_img)
    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)

    _, thresh = cv2.threshold(gray, 40, 255, cv2.THRESH_BINARY)

    cnts = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    contours = cnts[0] if len(cnts) == 2 else cnts[1]

    return contours

# ------------------------------
# DRAW BOXES
# ------------------------------
def draw_boxes(image_path, contours):
    image = cv2.imread(image_path)

    valid_contours = []

    for c in contours:
        if cv2.contourArea(c) > 120:
            x, y, w, h = cv2.boundingRect(c)
            cv2.rectangle(image, (x, y), (x+w, y+h), (255, 0, 0), 2)
            valid_contours.append(c)

    image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

    return image, valid_contours

# ------------------------------
# OCR FUNCTION
# ------------------------------
def run_ocr(image_path):
    results = reader.readtext(image_path)
    texts = [res[1] for res in results]
    return texts, results

# ------------------------------
# SCORING LOGIC
# ------------------------------
def compute_score(valid_contours, texts):
    score = 0
    reasons = []

    # ELA score
    if len(valid_contours) > 5:
        score += 40
        reasons.append("Multiple compression anomalies detected")

    elif len(valid_contours) > 2:
        score += 25
        reasons.append("Moderate suspicious regions detected")

    # Text check (simple rule)
    text_blob = " ".join(texts).lower()

    if any(name in text_blob for name in ["elon musk", "jeff bezos"]):
        score += 30
        reasons.append("Suspicious or unrealistic identity detected")

    if len(texts) < 3:
        score += 10
        reasons.append("Low OCR text content (possible tampering)")

    # Final classification
    if score > 70:
        status = "SUSPICIOUS"
    elif score > 40:
        status = "NEEDS REVIEW"
    else:
        status = "LIKELY GENUINE"

    return score, status, reasons

# ------------------------------
# MAIN APP
# ------------------------------
def main():
    st.set_page_config(page_title="DocGuard AI", layout="wide")

    st.title("🛡️ DocGuard AI – Explainable Document Forgery Detector")
    st.write("Upload a document (image/PDF) to detect forgery using OCR + ELA.")

    uploaded_file = st.file_uploader("Upload Document", type=["jpg","jpeg","png","pdf"])

    if uploaded_file:

        # Save temp file
        suffix = os.path.splitext(uploaded_file.name)[1]
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(uploaded_file.read())
            input_path = tmp.name

        # Handle PDF
        if suffix.lower() == ".pdf":
            pages = convert_from_path(input_path)
            img_path = "temp.jpg"
            pages[0].save(img_path, "JPEG")
        else:
            img_path = input_path

        with st.spinner("Analyzing document..."):

            # 1. ELA
            ela_img = perform_ela(img_path)
            contours = get_suspicious_regions(ela_img)

            # 2. Draw regions
            annotated_img, valid_contours = draw_boxes(img_path, contours)

            # 3. OCR
            texts, raw_ocr = run_ocr(img_path)

            # 4. Scoring
            score, status, reasons = compute_score(valid_contours, texts)

        # ---------------- UI ----------------
        col1, col2 = st.columns(2)

        with col1:
            st.subheader("📄 Annotated Document")
            st.image(annotated_img, width="stretch")

        with col2:
            st.subheader("🔥 ELA Map")
            st.image(ela_img, width="stretch")

        st.divider()

        # ---------------- REPORT ----------------
        st.subheader("📋 Explainable Report")

        if status == "SUSPICIOUS":
            st.error(f"Status: {status} | Confidence: {score}%")
        elif status == "NEEDS REVIEW":
            st.warning(f"Status: {status} | Confidence: {score}%")
        else:
            st.success(f"Status: {status} | Confidence: {100-score}%")

        st.write("### Reasons:")
        if reasons:
            for r in reasons:
                st.write(f"- {r}")
        else:
            st.write("- No strong anomalies detected")

        st.write("### Suspicious Regions Detected:", len(valid_contours))

        with st.expander("📄 Extracted Text"):
            st.write(texts)

# ------------------------------
if __name__ == "__main__":
    main()
