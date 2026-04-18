import streamlit as st
import cv2
import numpy as np
import easyocr
from PIL import Image, ImageChops, ImageEnhance
from pdf2image import convert_from_path
import os
import tempfile

# --- MODULE 1: IMAGE TAMPERING (ELA) ---
def perform_ela(image_path, quality=90):
    """
    Detects inconsistencies in image compression. 
    Manually edited areas usually show higher brightness in the ELA map.
    """
    original = Image.open(image_path).convert('RGB')
    
    # Save and reload at a specific quality to calculate compression loss
    with tempfile.NamedTemporaryFile(suffix='.jpg') as tmp:
        original.save(tmp.name, 'JPEG', quality=quality)
        temporary = Image.open(tmp.name)
        
        ela_image = ImageChops.difference(original, temporary)
        
        # Rescale brightness to make differences visible
        extrema = ela_image.getextrema()
        max_diff = max([ex[1] for ex in extrema])
        if max_diff == 0: max_diff = 1
        scale = 255.0 / max_diff
        ela_image = ImageEnhance.Brightness(ela_image).enhance(scale)
        
    return ela_image

# --- MODULE 2: LAYOUT & FONT ANALYSIS ---
def analyze_structure(ocr_results):
    """
    Analyzes bounding box geometry to detect font size mismatches 
    and alignment shifts.
    """
    flags = []
    suspicious_boxes = []
    heights = []
    
    for (bbox, text, prob) in ocr_results:
        # Calculate height of the bounding box
        h = abs(bbox[0][1] - bbox[2][1])
        heights.append(h)
        
    if not heights:
        return flags, suspicious_boxes

    avg_height = np.mean(heights)
    std_height = np.std(heights)

    for i, (bbox, text, prob) in enumerate(ocr_results):
        h = abs(bbox[0][1] - bbox[2][1])
        
        # Rule: Font Mismatch (Box height deviates significantly)
        if h > avg_height + (2 * std_height) or h < avg_height - (2 * std_height):
            flags.append(f"Font size anomaly in text: '{text}'")
            suspicious_boxes.append(bbox)
            
        # Rule: Alignment Check (Simple horizontal check)
        # In a standard doc, most text starts at similar X coordinates
        if bbox[0][0] < 5: # Too close to edge
             flags.append(f"Layout shift detected near: '{text}'")
             suspicious_boxes.append(bbox)

    return list(set(flags)), suspicious_boxes

# --- MODULE 3: ANNOTATION ---
def draw_suspicious_boxes(image_path, boxes):
    img = cv2.imread(image_path)
    for box in boxes:
        pts = np.array(box, np.int32).reshape((-1, 1, 2))
        cv2.polylines(img, [pts], True, (255, 0, 0), 2) # Red boxes
    return cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

# --- MAIN STREAMLIT APP ---
def main():
    st.set_page_config(page_title="DocGuard AI", layout="wide")
    st.title("🛡️ DocGuard: Explainable Document Forgery Detection")
    st.markdown("Prototype for detecting digital tampering and structural anomalies.")

    # Sidebar
    st.sidebar.header("Configuration")
    lang = st.sidebar.multiselect("Select OCR Languages", 
                                 ["en", "hi", "kn"], default=["en"])
    uploaded_file = st.sidebar.file_uploader("Upload Document (JPG, PNG, PDF)", 
                                            type=["jpg", "png", "jpeg", "pdf"])

    if uploaded_file:
        # Save upload to a temp file
        tfile = tempfile.NamedTemporaryFile(delete=False)
        tfile.write(uploaded_file.read())
        file_path = tfile.name

        # Handle PDF
        if uploaded_file.type == "application/pdf":
            st.info("Converting PDF to Image...")
            pages = convert_from_path(file_path)
            pages[0].save("page_1.jpg", "JPEG")
            img_path = "page_1.jpg"
        else:
            img_path = file_path

        col1, col2 = st.columns(2)

        with st.spinner("Analyzing Forensics..."):
            # 1. ELA Analysis
            ela_img = perform_ela(img_path)
            
            # 2. OCR Analysis
            reader = easyocr.Reader(lang, gpu=False)
            ocr_results = reader.readtext(img_path)
            
            # 3. Rule-based Detection
            text_flags, suspicious_boxes = analyze_structure(ocr_results)

        # SCORING LOGIC
        ela_intensity = np.mean(np.array(ela_img))
        ela_score = 30 if ela_intensity > 20 else 0
        text_score = min(len(text_flags) * 10, 50)
        total_score = ela_score + text_score
        
        # Display Results
        with col1:
            st.subheader("Original & Detection")
            annotated_img = draw_suspicious_boxes(img_path, suspicious_boxes)
            st.image(annotated_img, caption="Red boxes indicate layout/font anomalies", width=None)

        with col2:
            st.subheader("Forensic (ELA) Map")
            st.image(ela_img, caption="Brighter areas indicate potential pixel tampering", width=None)

        st.divider()

        # EXPLAINABLE REPORT
        st.subheader("📋 Explainable AI (XAI) Report")
        
        status = "GENUINE"
        color = "green"
        if total_score > 70:
            status = "SUSPICIOUS"
            color = "red"
        elif total_score > 40:
            status = "NEEDS REVIEW"
            color = "orange"

        st.markdown(f"### Status: :{color}[{status}]")
        st.write(f"**Overall Suspicion Score:** {total_score}/100")
        
        with st.expander("View Specific Reasons"):
            if ela_score > 0:
                st.write("- 🚩 **Compression Anomaly:** High ELA intensity detected. The image may have been resaved after local editing.")
            if text_flags:
                for flag in text_flags:
                    st.write(f"- 🚩 **Structural Issue:** {flag}")
            if not text_flags and ela_score == 0:
                st.write("- ✅ No significant anomalies found.")

        # OCR DATA PREVIEW
        st.subheader("📝 Extracted Text Preview")
        st.dataframe([{"Text": r[1], "Confidence": f"{r[2]*100:.2f}%"} for r in ocr_results])

if __name__ == "__main__":
    main()
