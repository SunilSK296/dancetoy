import streamlit as st
import cv2
import numpy as np
import easyocr
from PIL import Image, ImageChops, ImageEnhance
from pdf2image import convert_from_path
import tempfile
import os

# --- CORE FORENSICS ---

def perform_ela(image_path, quality=90):
    """Error Level Analysis to find digital tampering."""
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
    """Finds bright spots in ELA map using corrected OpenCV methods."""
    img = np.array(ela_image)
    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    _, thresh = cv2.threshold(gray, 40, 255, cv2.THRESH_BINARY)
    
    # FIXED: findContours (no underscore) + Version-safe unpacking
    cnts = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    contours = cnts[0] if len(cnts) == 2 else cnts[1]
    return contours

# --- MAIN APP ---

def main():
    st.set_page_config(page_title="DocGuard Pro", layout="wide")
    st.title("🛡️ DocGuard: XAI Forgery Detector")
    st.markdown("Prototype for **Hackathon 2026**. Detects tampering via ELA and Structural OCR.")

    uploaded_file = st.sidebar.file_uploader("Upload Document (JPG/PNG/PDF)", type=["jpg", "png", "jpeg", "pdf"])

    if uploaded_file:
        # Create temp file to store upload
        suffix = os.path.splitext(uploaded_file.name)[1]
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tfile:
            tfile.write(uploaded_file.read())
            input_path = tfile.name

        # PDF Handling
        if suffix.lower() == ".pdf":
            with st.spinner("Converting PDF..."):
                pages = convert_from_path(input_path)
                img_path = "temp_page.jpg"
                pages[0].save(img_path, "JPEG")
        else:
            img_path = input_path

        # Execution
        with st.spinner("Analyzing Forensics..."):
            # 1. Forensic ELA
            ela_result = perform_ela(img_path)
            contours = get_suspicious_regions(ela_result)
            
            # 2. Text Logic (Simplified for Demo)
            reader = easyocr.Reader(['en'], gpu=False)
            ocr_results = reader.readtext(img_path)
            extracted_text = [res[1] for res in ocr_results]

            # 3. Annotation
            annotated_img = cv2.imread(img_path)
            for c in contours:
                if cv2.contourArea(c) > 100: # Filter noise
                    x, y, w, h = cv2.boundingRect(c)
                    cv2.rectangle(annotated_img, (x, y), (x+w, y+h), (255, 0, 0), 3)
            annotated_img = cv2.cvtColor(annotated_img, cv2.COLOR_BGR2RGB)

        # UI LAYOUT
        col1, col2 = st.columns(2)
        with col1:
            st.subheader("Analysis View")
            # FIXED: width='stretch' for 2026 compatibility
            st.image(annotated_img, caption="Red Boxes = Potential Edits", width="stretch")
        
        with col2:
            st.subheader("ELA Forensic Map")
            st.image(ela_result, caption="Brighter areas = Compression Inconsistency", width="stretch")

        st.divider()

        # XAI REPORT
        st.subheader("📋 Explainable AI Report")
        suspicion_score = min(len(contours) * 4, 100)
        
        if suspicion_score > 60:
            st.error(f"STATUS: SUSPICIOUS (Confidence: {suspicion_score}%)")
            st.write("**Reasons:**")
            st.write("- Multiple high-frequency compression artifacts detected in localized areas.")
            if any(name in " ".join(extracted_text).lower() for name in ["elon musk", "jeff bezos"]):
                st.write("- 🚩 Blacklisted/Suspicious entity name detected in text.")
        else:
            st.success(f"STATUS: LIKELY GENUINE (Confidence: {100 - suspicion_score}%)")

        with st.expander("Show Extracted Text"):
            st.write(extracted_text)

if __name__ == "__main__":
    main()
