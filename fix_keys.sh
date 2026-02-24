#!/bin/bash
# data.jsonのキー名を修正
sed -i 's/"KDDI":/"kddi":/g' data.json
sed -i 's/"CTC":/"ctc":/g' data.json
echo "✓ data.json のキー名を修正しました (KDDI→kddi, CTC→ctc)"
