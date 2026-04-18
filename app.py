import streamlit as st
import cv2
import numpy as np
import easyocr
from PIL import Image, ImageChops, ImageEnhance
from pdf2image import convert_from_path
import tempfile
import os

def perform_ela(image_path, quality=90):
    original = Image.open(image_path).convert('RGB')
    with tempfile.NamedTemporaryFile(suffix='.jpg') as tmp:
        original.save(tmp.name, 'JPEG', quality=quality)
        temporary = Image.open(tmp.name)
        ela_image = ImageChops.difference(original, temporary)
        extrema = ela_image.getextrema()
        max_diff = max([ex[1] for ex in extrema]) or 1
        scale = 255.0 / max_diff
        return ImageEnhance.Brightness(ela_image).enhance(scale)

def get_suspicious_regions(ela_image):
    img = np.array(ela_image)
    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    _, thresh = cv2.threshold(gray, 40, 255, cv2.THRESH_BINARY)
    # FIXED: findContours (no underscore)
    cnts = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    return cnts[0] if len(cnts) == 2 else cnts[1]

def main():
    st.set_page_config(page_title="DocGuard", layout="wide")
    st.title("🛡️ DocGuard: Forgery Detection")

    uploaded_file = st.sidebar.file_uploader("Upload Image or PDF", type=["jpg", "png", "jpeg", "pdf"])

    if uploaded_file:
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(uploaded_file.name)[1]) as tfile:
            tfile.write(uploaded_file.read())
            file_path = tfile.name

        if uploaded_file.type == "application/pdf":
            pages = convert_from_path(file_path)
            pages[0].save("temp_page.jpg", "JPEG")
            img_path = "temp_page.jpg"
        else:
            img_path = file_path

        with st.spinner("Analyzing..."):
            ela_img = perform_ela(img_path)
            # OCR Setup
            reader = easyocr.Reader(['en'], gpu=False)
            results = reader.readtext(img_path)
            
            # Draw boxes on suspicious areas
            img = cv2.imread(img_path)
            # Use ELA to find boxes
            cnts = get_suspicious_regions(ela_img)
            for c in cnts:
                if cv2.contourArea(c) > 50:
                    x, y, w, h = cv2.boundingRect(c)
                    cv2.rectangle(img, (x, y), (x+w, y+h), (255, 0, 0), 2)
            
            final_img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

        col1, col2 = st.columns(2)
        col1.image(final_img, caption="Detected Anomalies", width="stretch") # 2026 syntax
        col2.image(ela_img, caption="ELA Forensic Map", width="stretch") # 2026 syntax

        st.write("### Explainability Report")
        if len(cnts) > 10:
            st.error("🚩 Status: Suspicious. High frequency of compression artifacts detected.")
        else:
            st.success("✅ Status: Likely Genuine.")

if __name__ == "__main__":
    main()
