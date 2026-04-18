import streamlit as st
import cv2
import numpy as np
import easyocr
from PIL import Image, ImageChops, ImageEnhance
import re

# --- 1. CORE FORGERY DETECTION FUNCTIONS ---

def perform_ela(image_path, quality=90):
    """
    Error Level Analysis: Detects differences in compression levels.
    """
    original = Image.open(image_path).convert('RGB')
    
    # Save and reload at a specific quality
    original.save("temp_ela.jpg", 'JPEG', quality=quality)
    temporary = Image.open("temp_ela.jpg")
    
    # Calculate pixel difference
    ela_image = ImageChops.difference(original, temporary)
    
    # Maximize the brightness of the difference to make it visible
    extrema = ela_image.getextrema()
    max_diff = max([ex[1] for ex in extrema])
    if max_diff == 0: max_diff = 1
    scale = 255.0 / max_diff
    
    ela_image = ImageEnhance.Brightness(ela_image).enhance(scale)
    return ela_image

def get_suspicious_regions(ela_image):
    """
    Uses OpenCV to find high-intensity clusters in the ELA map.
    """
    img = np.array(ela_image)
    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    _, thresh = cv2.threshold(gray, 40, 255, cv2.THRESH_BINARY)
    
    # FIX: This handles both OpenCV 3 and 4+
    cnts = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    contours = cnts[0] if len(cnts) == 2 else cnts[1]
    
    return contours

# --- 2. TEXT ANALYTICS ---

def analyze_text(text_list):
    """
    Rule-based checks for common forgery indicators.
    """
    reasons = []
    score_penalty = 0
    
    # Rule 1: Celebrity Names (Mock list)
    celebs = ['Elon Musk', 'Jeff Bezos', 'Iron Man', 'Barack Obama']
    found_celebs = [name for name in celebs if any(name.lower() in t.lower() for t in text_list)]
    if found_celebs:
        reasons.append(f"Suspicious Name Detected: {found_celebs[0]}")
        score_penalty += 40

    # Rule 2: Inconsistent Year (e.g., Certificate from 1990 but looks brand new)
    years = re.findall(r'\b(19|20)\d{2}\b', " ".join(text_list))
    if years and int(max(years)) > 2026:
        reasons.append("Future date detected - likely forgery.")
        score_penalty += 30

    # Rule 3: Keywords for official documents
    if not any(k in " ".join(text_list).lower() for k in ['certificate', 'id', 'license', 'official']):
        reasons.append("Missing official document identifiers.")
        score_penalty += 10
        
    return reasons, score_penalty

# --- 3. STREAMLIT UI ---

def main():
    st.set_page_config(page_title="DocGuard: XAI Forgery Detector", layout="wide")
    st.title("🛡️ DocGuard: Explainable Document Forgery Detection")
    st.write("Upload a document to check for digital tampering and text anomalies.")

    uploaded_file = st.sidebar.file_uploader("Upload Document (JPG/PNG)", type=["jpg", "jpeg", "png"])

    if uploaded_file is not None:
        # Save file to disk for processing
        with open("input_doc.jpg", "wb") as f:
            f.write(uploaded_file.getbuffer())

        col1, col2 = st.columns(2)

        with col1:
            st.subheader("Original Document")
            st.image(uploaded_file, use_container_width=True)

        # --- Execution ---
        with st.spinner("Analyzing compression artifacts (ELA)..."):
            ela_result = perform_ela("input_doc.jpg")
            contours = get_suspicious_regions(ela_result)
        
        with st.spinner("Running OCR & Rule Engine..."):
            reader = easyocr.Reader(['en'], gpu=False) # CPU Mode
            results = reader.readtext("input_doc.jpg")
            extracted_text = [res[1] for res in results]

        # --- Scoring Logic ---
        text_reasons, text_penalty = analyze_text(extracted_text)
        
        # ELA Score (based on number of suspicious clusters)
        ela_penalty = min(len(contours) * 2, 50) 
        total_suspicion = min(text_penalty + ela_penalty, 100)
        confidence = 100 - total_suspicion

        # --- UI Output ---
        with col2:
            st.subheader("Analysis Results")
            
            # Show ELA Map
            st.image(ela_result, caption="ELA Analysis (Bright spots = likely edits)", use_container_width=True)
            
            # Status Indicator
            if total_suspicion > 40:
                st.error(f"Status: SUSPICIOUS (Confidence: {total_suspicion}%)")
            else:
                st.success(f"Status: GENUINE (Confidence: {confidence}%)")

        st.divider()

        # Detailed Report
        res_col1, res_col2 = st.columns(2)
        with res_col1:
            st.subheader("📋 Explainable Report")
            if not text_reasons and len(contours) < 5:
                st.write("✅ No significant anomalies detected.")
            else:
                for r in text_reasons:
                    st.write(f"🚩 {r}")
                if len(contours) > 5:
                    st.write(f"🚩 High-frequency pixel variation detected in {len(contours)} regions.")

        with res_col2:
            st.subheader("🔤 Extracted Text")
            st.text_area("OCR Output", value="\n".join(extracted_text), height=200)

if __name__ == "__main__":
    main()
