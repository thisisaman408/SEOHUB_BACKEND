import os
import random
import re
import string
import time
import json
from datetime import datetime
from urllib.parse import urljoin

import google.generativeai as genai
import pymongo
import pyperclip
from bson.objectid import ObjectId
from bcrypt import gensalt, hashpw
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from requests import get
from requests.exceptions import RequestException

# Imports for browser automation
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service as ChromeService
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager


# --- CONFIGURATION ---
load_dotenv()
MONGO_URI = os.getenv("MONGO_URI")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
WRITE_TO_DB = False # Set to False for a "dry run"

if not all([MONGO_URI, GEMINI_API_KEY]):
    raise ValueError("MONGO_URI and GEMINI_API_KEY must be set in the .env file.")

genai.configure(api_key=GEMINI_API_KEY)

RELEVANT_CATEGORIES = ["seo", "marketing", "social media", "management", "sales", "productivity"]
SOURCE_DIRECTORY = "https://theresanaiforthat.com/"

# --- HELPER FUNCTIONS ---

class MongoJsonEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, ObjectId):
            return str(o)
        return json.JSONEncoder.default(self, o)

def save_data_to_logfile(user_doc, tool_doc):
    print("📝 Saving generated data to scraper_log.txt...")
    try:
        with open("scraper_log.txt", "a", encoding="utf-8") as f:
            f.write(f"{'='*20} NEW ENTRY: {datetime.now().isoformat()} {'='*20}\n\n")
            f.write("--- USER DOCUMENT ---\n")
            f.write(json.dumps(user_doc, indent=4, cls=MongoJsonEncoder))
            f.write("\n\n")
            f.write("--- TOOL DOCUMENT ---\n")
            f.write(json.dumps(tool_doc, indent=4, cls=MongoJsonEncoder))
            f.write("\n\n")
        print("✅ Data successfully saved to log file.")
    except Exception as e:
        print(f"❌ Failed to write to log file: {e}")

# --- DATABASE SETUP ---

def get_db_connection():
    try:
        client = pymongo.MongoClient(MONGO_URI)
        client.admin.command('ping')
        print("✅ MongoDB connection successful.")
        return client.get_database()
    except Exception as e:
        print(f"❌ Could not connect to MongoDB: {e}")
        return None

# --- STAGE 1: DIRECTORY SCRAPING (ROBUST SELENIUM VERSION) ---

def setup_selenium_driver():
    print("Setting up Selenium WebDriver...")
    chrome_options = Options()
    # Running in non-headless mode is often more reliable for complex sites
    # and allows you to see what the script is doing.
    # To run headless again, uncomment the line below.
    # chrome_options.add_argument("--headless") 
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36")
    
    driver = webdriver.Chrome(service=ChromeService(ChromeDriverManager().install()), options=chrome_options)
    print("✅ WebDriver is ready.")
    return driver

def scrape_directory_for_tool_urls(db, driver):
    print("\n--- STAGE 1: Scraping Directory for Tool URLs using Selenium ---")
    detail_page_urls = set()
    final_tool_urls = set()

    try:
        print(f"Navigating to {SOURCE_DIRECTORY}...")
        driver.get(SOURCE_DIRECTORY)
        wait = WebDriverWait(driver, 20)
        
        # New: Handle cookie consent banner
        try:
            print("Looking for cookie consent button...")
            consent_button = wait.until(EC.element_to_be_clickable((By.ID, "ez-accept-all")))
            consent_button.click()
            print("✅ Clicked cookie consent button.")
            time.sleep(2)
        except Exception:
            print("⚠️ No cookie consent button found or it was not clickable. Continuing...")

        # Scroll to load more tools
        print("Scrolling to load tools...")
        for _ in range(5):
            driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
            time.sleep(2)
        
        # Find links to the detail pages
        print("Waiting for tool cards to become visible...")
        wait.until(EC.presence_of_all_elements_located((By.CSS_SELECTOR, "a.g-card")))
        tool_cards = driver.find_elements(By.CSS_SELECTOR, "a.g-card")
        for card in tool_cards:
            href = card.get_attribute('href')
            if href:
                detail_page_urls.add(href)
        
        print(f"Found {len(detail_page_urls)} tool detail pages.")

        # Visit each detail page to click "Copy" and get the external URL
        for url in list(detail_page_urls)[:10]: # Limiting to 10 for testing purposes
            print(f"  -> Visiting detail page: {url}")
            try:
                driver.get(url)
                # This XPath finds the button that contains the text "Copy"
                copy_button = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[contains(., 'Copy')]")))
                
                # A more direct click via JavaScript
                driver.execute_script("arguments[0].click();", copy_button)
                time.sleep(0.5) # Wait for clipboard to update

                # Read from clipboard
                external_url = pyperclip.paste()
                
                if external_url and external_url.startswith('http'):
                    if db is not None and db.tools.find_one({"websiteUrl": external_url}):
                        print(f"    ⚠️ External URL already in DB. Skipping.")
                        continue
                    
                    print(f"    ✅ Extracted external URL from clipboard: {external_url}")
                    final_tool_urls.add(external_url)
                else:
                    print(f"    ⚠️ Could not get a valid URL from clipboard.")
            except Exception as e:
                print(f"    ❌ Could not process detail page {url}. Error: {e}")

    except Exception as e:
        print(f"An error occurred during Selenium scraping: {e}")

    print(f"--- Found {len(final_tool_urls)} new, unique external tool URLs. ---")
    return list(final_tool_urls)

# --- STAGE 2: WEBSITE PROCESSING & DATA ENRICHMENT (No changes below this line) ---

def get_website_content(url):
    try:
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}
        response = get(url, headers=headers, timeout=15)
        response.raise_for_status()
        soup = BeautifulSoup(response.content, 'html.parser')
        
        for element in soup(["script", "style", "nav", "footer", "header", "aside"]):
            element.decompose()
            
        text = ' '.join(soup.stripped_strings)
        return text
    except RequestException as e:
        print(f"Error fetching content for {url}: {e}")
        return None

def is_tool_relevant(content):
    if not content: return False
    model = genai.GenerativeModel('gemini-1.5-flash')
    prompt = f"""Is this AI tool for: {', '.join(RELEVANT_CATEGORIES)}? Answer "Yes" or "No".\n\nText: "{content[:2000]}" """
    try:
        response = model.generate_content(prompt)
        return "yes" in response.text.lower()
    except Exception as e:
        print(f"Gemini relevance check failed: {e}")
        return False

def generate_tool_data_with_gemini_chunked(full_content, url):
    if not full_content: return None
    model = genai.GenerativeModel('gemini-1.5-flash')
    text_chunks = [full_content[i:i + 7000] for i in range(0, len(full_content), 7000)]
    summaries = []
    print(f"Processing content in {len(text_chunks)} chunk(s)...")
    for chunk in text_chunks:
        try:
            summary_prompt = f"Summarize the tool's features and purpose from this text:\n\n{chunk}"
            response = model.generate_content(summary_prompt)
            summaries.append(response.text)
        except Exception as e:
            print(f"Gemini chunk summarization failed: {e}")
    combined_summary = "\n".join(summaries)
    final_prompt = f"""From the summary of {url}, create a JSON object: "name", "tagline", "description", "tags" (5-7 keywords), and "visual" (a JSON object with a "color" ['blue', 'green', 'purple', 'orange'] and a "content" array of 3 objects, each with "icon" ['zap', 'bar-chart'] and "text").\n\nSummary:\n{combined_summary}\n\nReturn ONLY the JSON object."""
    try:
        final_response = model.generate_content(final_prompt)
        match = re.search(r'\{.*\}', final_response.text, re.DOTALL)
        if match: return json.loads(match.group(0))
        else: print("Gemini did not return valid JSON."); return None
    except Exception as e:
        print(f"Error in final Gemini call: {e}"); return None

# --- DATABASE OPERATIONS ---

def hash_password(password):
    return hashpw(password.encode('utf-8'), gensalt())

def prepare_user_doc(db, company_name):
    safe_company_name = re.sub(r'[^a-zA-Z0-9]', '', company_name)
    placeholder_email = f"contact@{safe_company_name.lower()}.ai-tools.com"
    if db is not None:
        existing_user = db.users.find_one({"email": placeholder_email})
        if existing_user:
            print(f"Found existing user for '{company_name}'.")
            return existing_user
    random_password = ''.join(random.choices(string.ascii_letters + string.digits, k=32))
    return {"_id": ObjectId(), "companyName": company_name, "email": placeholder_email, "password": hash_password(random_password).decode('utf-8'), "role": "user", "source": "scraped", "createdAt": datetime.utcnow(), "updatedAt": datetime.utcnow()}

def prepare_tool_doc(enriched_data, submitter_id):
    return {"_id": ObjectId(), "name": enriched_data.get("name", "Unknown Tool"), "tagline": enriched_data.get("tagline", "Tagline not found."), "description": enriched_data.get("description", "Description not found."), "websiteUrl": enriched_data["websiteUrl"], "tags": enriched_data.get("tags", []), "status": "approved", "isFeatured": False, "submittedBy": submitter_id, "visual": enriched_data.get("visual", {}), "source": "scraped", "createdAt": datetime.utcnow(), "updatedAt": datetime.utcnow()}

# --- MAIN SCRIPT LOGIC ---

def main():
    db = get_db_connection()
    if db is None:
        print("Database connection failed. Exiting.")
        return

    driver = setup_selenium_driver()
    try:
        new_tool_urls = scrape_directory_for_tool_urls(db, driver)
    finally:
        driver.quit()
    
    if not new_tool_urls:
        print("No new tools found in directories. Exiting.")
        return
        
    print(f"\n--- STAGE 2: Processing {len(new_tool_urls)} New Tools ---")
    for url in new_tool_urls:
        print(f"\n{'='*20}\nProcessing URL: {url}")
        content = get_website_content(url)
        if not content: continue

        print("Checking tool relevance...");
        if not is_tool_relevant(content):
            print(f"Tool at {url} not relevant. Skipping."); continue
        print("✅ Tool is relevant.")

        print("Generating structured data with Gemini...");
        enriched_data = generate_tool_data_with_gemini_chunked(content, url)
        if not enriched_data or not enriched_data.get("name"):
            print(f"Could not generate data for {url}. Skipping."); continue
        print(f"✅ Gemini data generation successful for '{enriched_data.get('name')}'")
        
        enriched_data["websiteUrl"] = url
        user_doc = prepare_user_doc(db, enriched_data["name"])
        tool_doc = prepare_tool_doc(enriched_data, user_doc['_id'])
        save_data_to_logfile(user_doc, tool_doc)

        if WRITE_TO_DB:
            print("Writing to database...")
            try:
                if db is not None and not db.users.find_one({"_id": user_doc['_id']}):
                     db.users.insert_one(user_doc)
                     print(f"Inserted new user '{user_doc['companyName']}' into DB.")
                if db is not None and not db.tools.find_one({"websiteUrl": tool_doc['websiteUrl']}):
                    db.tools.insert_one(tool_doc)
                    print(f"Inserted new tool '{tool_doc['name']}' into DB.")
                else:
                    print(f"Tool '{tool_doc['name']}' already exists in DB. Skipping insert.")
            except Exception as e:
                print(f"❌ Database write failed: {e}")
        else:
            print("Database write is disabled. Skipping DB insertion.")
        time.sleep(random.randint(3, 7))
        
    print(f"\n--- Scraper run finished. Processed {len(new_tool_urls)} URLs. ---")

if __name__ == "__main__":
    main()
