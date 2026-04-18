import streamlit as st
import cv2
import numpy as np
import easyocr
from PIL import Image, ImageChops, ImageEnhance
import re
import os

# --- CORE FUNCTIONS ---

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
    # FIX: Correct function name is findContours
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
    
    # Universal forgery flags
    if any(name in full_text for name in ['elon musk', 'jeff bezos', 'iron man']):
        reasons.append("Suspicious celebrity name detected.")
        score_penalty += 45
    return reasons, score_penalty

# --- MAIN APP ---

def main():
    st.set_page_config(page_title="DocGuard", layout="wide")
    st.title("🛡️ DocGuard Prototype")

    # Check if dependencies are actually loaded
    try:
        import cv2
        import easyocr
    except ImportError as e:
        st.error(f"Dependency Error: {e}. Check your requirements.txt")
        return

    uploaded_file = st.sidebar.file_uploader("Upload Image", type=["jpg", "png"])

    if uploaded_file:
        # Standardize image for processing
        file_bytes = np.asarray(bytearray(uploaded_file.read()), dtype=np.uint8)
        img = cv2.imdecode(file_bytes, 1)
        cv2.imwrite("temp.jpg", img)

        st.info("🔄 Running analysis... this may take a minute on the first run.")
        
        try:
            # 1. ELA
            ela_img = perform_ela("temp.jpg")
            
            # 2. OCR
            reader = easyocr.Reader(['en'], gpu=False)
            results = reader.readtext("temp.jpg")
            text = [res[1] for res in results]

            # Display
            col1, col2 = st.columns(2)
            col1.image(uploaded_file, caption="Original", width="stretch")
            col2.image(ela_img, caption="Tamper Map", width="stretch")
            
            st.success("Analysis Complete")
            st.write("**Extracted Text:**", text)

        except Exception as e:
            st.error(f"Processing Error: {str(e)}")

if __name__ == "__main__":
    main()
