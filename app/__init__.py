from flask import Flask
import os
from .src.models import load_all_architectures, available_attacks

APP_ROOT_PATH = os.path.dirname(os.path.abspath(__file__))
ctx = load_all_architectures(APP_ROOT_PATH)
if len(ctx['nli']) == 0:
    raise Exception("No NLI models found. Please enable at least one NLI model in app/models.")
ctx['attacks'] = available_attacks

app = Flask(__name__, instance_relative_config=True)
app.config["TEMPLATES_AUTO_RELOAD"] = True
app.config.from_mapping(
    SECRET_KEY='\x7f\x08FG2\x1a\x99R\xf67\xaa\xc8\xb0e\x1d\xc4\xdb\x00`\x89\x8aK\xb4*',
)

from . import routes
