from dotenv import load_dotenv
load_dotenv(dotenv_path="arquivo.env", override=True)

import os
import smtplib

smtp_host = os.getenv("SMTP_HOST")
smtp_port = int(os.getenv("SMTP_PORT", "587"))
smtp_user = os.getenv("SMTP_USER")
smtp_pass = os.getenv("SMTP_PASS")

print("HOST:", smtp_host)
print("PORT:", smtp_port)
print("USER:", smtp_user)
print("PASS len:", len(smtp_pass or ""))

with smtplib.SMTP(smtp_host, smtp_port, timeout=30) as server:
    server.set_debuglevel(1)
    server.ehlo()
    server.starttls()
    server.ehlo()
    server.login(smtp_user, smtp_pass)
    print("LOGIN OK")