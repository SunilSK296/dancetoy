import streamlit as st
import cv2
import numpy as np
import easyocr
from PIL import Image, ImageChops, ImageEnhance
import re

def perform_ela(image_path, quality=90):
    original = Image.open(image_path).convert('RGB')
    original.save("temp_ela.jpg", 'JPEG', quality=quality)
    temporary = Image.open("temp_ela.jpg")
    ela_image = ImageChops.difference(original, temporary)
    extrema = ela_image.getextrema()
    max_diff = max([ex[1] for ex in extrema])
    if max_diff == 0: max_diff = 1
    scale = 255.0 / max_diff
    return ImageEnhance.Brightness(ela_image).enhance(scale)

def get_suspicious_regions(ela_image):
    img = np.array(ela_image)
    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    _, thresh = cv2.threshold(gray, 40, 255, cv2.THRESH_BINARY)
    # Corrected: findContours
    cnts = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    return cnts[0] if len(cnts) == 2 else cnts[1]

def analyze_text(text_list, lang_code='en'):
    reasons = []
    score_penalty = 0
    full_text = " ".join(text_list).lower()
    keywords = {
        'en': ['certificate', 'official', 'identity', 'document', 'license'],
        'es': ['certificado', 'oficial', 'identidad', 'documento', 'licencia'],
        'hi': ['प्रमाणपत्र', 'आधिकारिक', 'पहचान', 'दस्तावेज', 'लाइसेंस']
    }
    curr_keys = keywords.get(lang_code, keywords['en'])
    if not any(k in full_text for k in curr_keys):
        reasons.append(f"Missing {lang_code.upper()} official identifiers.")
        score_penalty += 15
    if any(name in full_text for name in ['elon musk', 'jeff bezos']):
        reasons.append("Suspicious celebrity name detected.")
        score_penalty += 45
    return reasons, score_penalty

def main():
    st.set_page_config(page_title="DocGuard", layout="wide")
    st.title("🛡️ DocGuard: Multi-Language Forgery Detection")

    lang_map = {"English": "en", "Spanish": "es", "Hindi": "hi"}
    lang_name = st.sidebar.selectbox("Language", list(lang_map.keys()))
    uploaded_file = st.sidebar.file_uploader("Upload Image", type=["jpg", "jpeg", "png"])

    if uploaded_file:
        with open("input_doc.jpg", "wb") as f:
            f.write(uploaded_file.getbuffer())
        
        with st.spinner("Analyzing..."):
            ela_img = perform_ela("input_doc.jpg")
            contours = get_suspicious_regions(ela_img)
            reader = easyocr.Reader(['en', lang_map[lang_name]], gpu=False)
            results = reader.readtext("input_doc.jpg")
            text = [res[1] for res in results]

        reasons, penalty = analyze_text(text, lang_map[lang_name])
        score = max(0, 100 - (penalty + min(len(contours)*2, 40)))

        col1, col2 = st.columns(2)
        with col1:
            st.subheader("Original")
            st.image(uploaded_file, width="stretch") # Updated syntax
        with col2:
            st.subheader("ELA Tamper Map")
            st.image(ela_img, width="stretch") # Updated syntax

        if score < 60:
            st.error(f"Status: SUSPICIOUS (Confidence: {100-score}%)")
        else:
            st.success(f"Status: GENUINE (Confidence: {score}%)")
        
        st.write("### Explainability Report")
        for r in reasons: st.write(f"- {r}")
        if len(contours) > 15: st.write("- High frequency compression artifacts detected.")

if __name__ == "__main__":
    main()
