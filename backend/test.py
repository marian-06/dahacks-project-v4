# flask app
from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route('/')
def index():
    return "server is running"

# i wanna create endpoint that received json includes flash card description and generates me flash cards/audio
@app.route('/process', methods=['POST', 'GET'])
def process():
    data = request.json
    flash_card_description = data.get('flash_card_description')
    flash_cards = generate_flash_cards(flash_card_description)
    return jsonify({'flash_cards': flash_cards})



if __name__ == '__main__':
    app.run(debug=True)