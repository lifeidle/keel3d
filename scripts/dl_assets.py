import os
# force in-process proxy env (system-injected 1218 is dead; 7890 is the live one)
os.environ["HTTP_PROXY"] = "http://127.0.0.1:7890"
os.environ["HTTPS_PROXY"] = "http://127.0.0.1:7890"
os.environ["http_proxy"] = "http://127.0.0.1:7890"
os.environ["https_proxy"] = "http://127.0.0.1:7890"
import gdown
PACKS = {
    "animatedtanks": "1tHX0RF9l4Nw4EZwxH6xWta0HsICU2h-G",
    "animatedmen": "17LibivOaUidsQhSkcxP3YYvDr0n7wIwu",
    "buildings": "1uWCsV9QfnAu8u_QbwkYwOfuU3McME7CA",
    "ultimategun": "12V-mHNB6bnW2WzgpJfRBQd-TG4pOO3yx",
    "survival": "1NKfC95GMWWJquy6rRzwFVkVDoZ_QP7K_",
    "ships": "1Qf31QTnGfxRzYxx8dHmlVGDT4KmIa0Vy",
    "stylizedtree": "1GlrFUFcNj6KIuc4-QpVEiRcXVUzSClP2",
    "ultimatenature": "1-Kl0L_Jg8awbh0S5T-z3zxh4mVlnxTpa",
}
os.makedirs("assets_new", exist_ok=True)
for name, fid in PACKS.items():
    out = os.path.join("assets_new", name)
    if os.path.isdir(out) and os.listdir(out):
        print(f"=== {name} already present, skip ===")
        continue
    print(f"=== downloading {name} ===", flush=True)
    try:
        gdown.download_folder(
            url=f"https://drive.google.com/drive/folders/{fid}",
            output=out, quiet=False, use_cookies=False,
        )
        print(f"=== {name} DONE ===", flush=True)
    except Exception as e:
        print(f"=== {name} FAILED: {type(e).__name__} {str(e)[:150]} ===", flush=True)
print("=== ALL DONE ===", flush=True)
