import streamlit as st
import cv2
import numpy as np
import easyocr
from PIL import Image, ImageChops, ImageEnhance
import re

# --- 1. CORE FORGERY DETECTION FUNCTIONS ---

def perform_ela(image_path, quality=90):
    """
    Error Level Analysis (ELA): Detects differences in compression levels.
    Digital edits often leave different compression traces than the original image.
    """
    original = Image.open(image_path).convert('RGB')
    
    # Save and reload at a specific quality to find the difference
    original.save("temp_ela.jpg", 'JPEG', quality=quality)
    temporary = Image.open("temp_ela.jpg")
    
    ela_image = ImageChops.difference(original, temporary)
    
    # Boost brightness to make the differences visible to the human eye
    extrema = ela_image.getextrema()
    max_diff = max([ex[1] for ex in extrema])
    if max_diff == 0: max_diff = 1
    scale = 255.0 / max_diff
    
    return ImageEnhance.Brightness(ela_image).enhance(scale)

def get_suspicious_regions(ela_image):
    """
    Finds high-intensity clusters in the ELA map using OpenCV.
    """
    img = np.array(ela_image)
    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    _, thresh = cv2.threshold(gray, 40, 255, cv2.THRESH_BINARY)
    
    # Version-agnostic contour detection (Handles OpenCV 3 and 4+)
    cnts = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    contours = cnts[0] if len(cnts) == 2 else cnts[1]
    return contours

# --- 2. MULTI-LANGUAGE RULE ENGINE ---

def analyze_text(text_list, lang_code='en'):
    """
    Rule-based checks for common forgery indicators across multiple languages.
    """
    reasons = []
    score_penalty = 0
    full_text = " ".join(text_list).lower()
    
    # Language-specific official keywords
    keywords = {
        'en': ['certificate', 'official', 'identity', 'document', 'license', 'university'],
        'es': ['certificado', 'oficial', 'identidad', 'documento', 'licencia', 'universidad'],
        'fr': ['certificat', 'officiel', 'identité', 'document', 'permis', 'université'],
        'hi': ['प्रमाणपत्र', 'आधिकारिक', 'पहचान', 'दस्तावेज', 'लाइसेंस', 'विश्वविद्यालय']
    }
    
    # Rule 1: Check for official identifiers
    current_keywords = keywords.get(lang_code, keywords['en'])
    if not any(k in full_text for k in current_keywords):
        reasons.append(f"Missing standard {lang_code.upper()} official terminology.")
        score_penalty += 15

    # Rule 2: Celebrity Names (Universal)
    celebs = ['Elon Musk', 'Jeff Bezos', 'Lionel Messi', 'Cristiano Ronaldo', 'Iron Man']
    found_celebs = [name for name in celebs if name.lower() in full_text]
    if found_celebs:
        reasons.append(f"Suspicious Name Detected: {found_celebs[0]}")
        score_penalty += 45

    # Rule 3: Date Anomaly (Detecting future years)
    years = re.findall(r'\b(20)\d{2}\b', full_text)
    if years and int(max(years)) > 2026:
        reasons.append(f"Invalid Date: Year {max(years)} detected.")
        score_penalty += 30
        
    return reasons, score_penalty

# --- 3. STREAMLIT UI ---

def main():
    st.set_page_config(page_title="Global DocGuard XAI", layout="wide")
    st.title("🛡️ Global DocGuard: Explainable Forgery Detection")
    st.markdown("This prototype uses **Error Level Analysis (ELA)** for pixel-level tampering and **Rule-Based OCR** for textual anomalies.")

    # Sidebar setup
    st.sidebar.header("Settings")
    lang_options = {
        "English": "en",
        "Spanish": "es",
        "French": "fr",
        "Hindi": "hi"
    }
    selected_lang_name = st.sidebar.selectbox("Document Language", list(lang_options.keys()))
    lang_code = lang_options[selected_lang_name]
    
    uploaded_file = st.sidebar.file_uploader("Upload Document (JPG, PNG)", type=["jpg", "jpeg", "png"])

    if uploaded_file is not None:
        # Save temp file
        with open("input_doc.jpg", "wb") as f:
            f.write(uploaded_file.getbuffer())

        col1, col2 = st.columns(2)

        # 1. Processing Stage
        with st.spinner(f"Analyzing in {selected_lang_name}..."):
            # Run ELA
            ela_result = perform_ela("input_doc.jpg")
            contours = get_suspicious_regions(ela_result)
            
            # Run OCR (Loading both English and Selected Language)
            reader = easyocr.Reader(['en', lang_code], gpu=False)
            ocr_results = reader.readtext("input_doc.jpg")
            extracted_text = [res[1] for res in ocr_results]

        # 2. Logic & Scoring
        text_reasons, text_penalty = analyze_text(extracted_text, lang_code)
        ela_penalty = min(len(contours) * 3, 50) # Scale penalty based on ELA noise
        
        total_suspicion = min(text_penalty + ela_penalty, 100)
        confidence = 100 - total_suspicion

        # 3. Visual Results
        with col1:
            st.subheader("Original Document")
            st.image(uploaded_file, use_container_width=True)
            
            st.subheader("Extracted Text")
            st.info("\n".join(extracted_text) if extracted_text else "No text detected.")

        with col2:
            st.subheader("ELA Analysis")
            st.image(ela_result, caption="Bright areas indicate potential digital tampering.", use_container_width=True)
            
            st.subheader("Detection Status")
            if total_suspicion > 40:
                st.error(f"🚩 SUSPICIOUS (Confidence: {total_suspicion}%)")
            else:
                st.success(f"✅ GENUINE (Confidence: {confidence}%)")

        st.divider()

        # 4. Explainability Report
        st.subheader("📋 Explainable AI (XAI) Report")
        rep_col1, rep_col2 = st.columns(2)
        
        with rep_col1:
            st.write("**Visual Anomalies:**")
            if len(contours) > 10:
                st.write(f"- ⚠️ High pixel-level inconsistency detected in {len(contours)} areas.")
            else:
                st.write("- ✅ No significant pixel tampering detected.")
        
        with rep_col2:
            st.write("**Textual Anomalies:**")
            if text_reasons:
                for r in text_reasons:
                    st.write(f"- ⚠️ {r}")
            else:
                st.write("- ✅ Textual patterns appear consistent with official records.")

if __name__ == "__main__":
    main()
