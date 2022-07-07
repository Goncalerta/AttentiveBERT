# AttentiveBERT

This project has been developed by Pedro Gonçalo Correia for the curricular unit _Capstone Project_ at [Faculdade de Engenharia da Universidade do Porto](https://fe.up.pt), as well as the [Gulbenkian Foundation](https://gulbenkian.pt/)'s New Talents in Artificial Inteligence program.

The website's main goal is to facilitate the visualization of attention weights in BERT-based models, allowing the user to input one pair of sentences (or two pairs, and then compare them), see the model predictions, and inspect the attention weights of each head and layer, as well as the mean value of the attention weights in all heads for a single layer or vice-versa and the mean value of the attention weights in all layers and all heads. The website is designed to work with the NLP classification tasks of Natural Language Inference, Argumentative Relation Identification, and Fact Verification.

It is also possible to generate adversarial attacks using one of many methods in the literature, such as TextFooler or BERT-Attack. Since generating adversarial attacks takes a long time, and in many cases no successful attack is found for an input pair of sentences, a list of pregenerated attacks is also provided. The input before and after the adversarial attack may be compared with the visualization of attention weights.

This website also has a didatic component, with an explanation of the main concepts related to the research problem's theme (_Explaining Shortcut Learning Through Attention Models_) that are also relevant to the website, as well as tooltips and guides in the visualization pages to help the user understand how to use the website and the concepts they are interacting with.

## Dependencies

Running this website requires Python3.7.9 with the following dependencies: 

- [flask](https://flask.palletsprojects.com/en/2.1.x/) 
- [pytorch](https://pytorch.org/) 
- [transformers](https://huggingface.co/docs/transformers/main/en/index) 
- [textattack](https://textattack.readthedocs.io/en/latest/)

It is also necessary to use [node](https://nodejs.org/en/) and [webpack](https://webpack.js.org/) if you want to rebuild the SCSS or the JS files.

This website uses [Bootstrap](https://getbootstrap.com/) but it is already included in the resources folder.

## Usage instructions

If you want to rebuild the SCSS and JS files, run the following command:

```bash
npx webpack build --watch
```

In order to start the server you may run:

```bash
python -m flask run
```

## Models

This project includes the configuration of a single DistilBERT model trained on the SNLI dataset as an example.
However it is easy to extend the website to include other models for the NLI, ARI and FV tasks. This can be done
by creating a `.json` file in the `app/models` folder for each model to include. 

In order for the server to start, it is mandatory that at least one NLI model is configured and enabled. ARI and FV
models are optional.

The syntax for the configuration file (with the default values) is as follows:

```json
{
    "source": *NOT OPTIONAL*, // String. The HuggingFace source for the model, for example "boychaboy/SNLI_distilbert-base-cased"
    "task": *NOT OPTIONAL*, // String. The task (NLI, ARI, FV)
    "disabled": false, // Boolean. Whether this model is disabled. Disabled models are ignored when starting the server.
    "model_name": null, // String. The name of the model (BERT-BASE, DistilBERT, ...)
    "cased": null, // Boolean. Whether this model is case-sensitive
    "training_dataset": null, // String. The name of the training dataset (SNLI, ...)
    "description": "", // String. A description of the model that will appear in its tooltip
    "prediction_columns": null, // A mapping from prediction labels to their corresponding id. If null, it is fetched from source. For an example, see "label2id" in https://huggingface.co/boychaboy/SNLI_distilbert-base-cased/raw/main/config.json

    "adversarial_attacks": [ // Default empty. List of pregenerated adversarial attacks.
        {
            "attack": *NOT OPTIONAL*, // String. The name of the attack (TextFooler, BERT-Attack, ...)
            "original": {
                "sentence_1": *NOT OPTIONAL*, // String. Original first sentence
                "sentence_2": *NOT OPTIONAL*, // String. Original second sentence
                "prediction": {
                    "contradiction": *NOT OPTIONAL*, // Float. Confidence in the negative label for the original prediction (for ARI and FV tasks the key is respectively "attack" and "attacks")
                    "entailment": *NOT OPTIONAL*, // Float. Confidence in the positive label for the original prediction (for ARI and FV tasks the key is respectively "support" and "supports")
                    "neutral": *NOT OPTIONAL*, // Float. Confidence in the neutral label for the original prediction (for ARI and FV tasks the key is respectively "none and "not enough info")
                }
            },
            "attacked": {
                "sentence_1": *NOT OPTIONAL*, // String. Attacked first sentence
                "sentence_2": *NOT OPTIONAL*, // String. Attacked second sentence
                "prediction": {
                    "contradiction": *NOT OPTIONAL*, // Float. Confidence in the negative label for the attacked prediction (for ARI and FV tasks the key is respectively "attack" and "attacks")
                    "entailment": *NOT OPTIONAL*, // Float. Confidence in the positive label for the attacked prediction (for ARI and FV tasks the key is respectively "support" and "supports")
                    "neutral": *NOT OPTIONAL*, // Float. Confidence in the neutral label for the attacked prediction (for ARI and FV tasks the key is respectively "none and "not enough info")
                }
            }
        },
    ]
}
```
