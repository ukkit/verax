"""Reference parse: runs casparser (MIT, https://github.com/codereverser/casparser) on a statement and dumps its data
to JSON. Raw output contains personal data, so it goes to out/ and run.sh deletes it. Prints a status line only.
The password comes from the CAS_PW environment variable."""
import json
import os
import sys

import casparser

pdf, out = sys.argv[1], sys.argv[2]
try:
    data = casparser.read_cas_pdf(pdf, os.environ.get("CAS_PW"), output="dict")
except Exception as e:  # the message names the failure, never the file's contents
    print(f"oracle FAILED: {type(e).__name__}: {str(e)[:120]}")
    sys.exit(1)
if hasattr(data, "model_dump"):
    data = data.model_dump(mode="json")
with open(out, "w") as f:
    json.dump(data, f, default=str)
print("oracle ok:", data.get("cas_type"), data.get("file_type"))
