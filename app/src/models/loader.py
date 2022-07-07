import os
import json
from platform import architecture
from .architecture import Architecture

def load_architecture(file):
    content = json.load(file)
    if content.get("disabled", False):
        return None
    return Architecture(
        source=content["source"], 
        task=content["task"], 
        name=content.get("model_name", None), 
        description=content.get("description", ''),
        adversarial_attacks=content.get("adversarial_attacks", []),
        training_dataset=content.get("training_dataset", None),
        cased=content.get("cased", None),
        prediction_columns=content.get("prediction_columns", None)
    )

def get_models_files(root_path):
    MODELS_DIR = os.path.join(root_path, "models")
    return [os.path.join(MODELS_DIR, file) for file in os.listdir(MODELS_DIR) if os.path.isfile(os.path.join(MODELS_DIR, file))]

def load_all_architectures(root_path):
    architectures = {
        "nli": [],
        "ari": [],
        "fv": [],
    }
    for filename in get_models_files(root_path):
        with open(filename, "r") as file:
            architecture = load_architecture(file)
            if architecture != None:
                architectures[architecture.task].append(architecture)
    
    return architectures
