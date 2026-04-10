export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GROQ_API_KEY not configured' });

  try {
    const { image, mediaType, text } = req.body;
    if (!image && !text) return res.status(400).json({ error: 'No image or text provided' });

    const systemPrompt = `Tu es un nutritionniste expert. Tu analyses des aliments et retournes les informations nutritionnelles précises.

Réponds UNIQUEMENT en JSON valide, sans backticks ni markdown ni texte autour, avec exactement ce format:
{"foods":[{"name":"Nom en français","icon":"emoji","cal":0,"protein":0,"carbs":0,"fat":0,"grams":0}]}

Règles:
- cal = calories totales pour la portion/quantité mentionnée
- protein/carbs/fat en grammes pour la portion mentionnée
- grams = poids total en grammes
- icon = un seul emoji représentant l'aliment
- Si plusieurs aliments sont mentionnés, liste-les tous séparément
- Si une quantité est précisée (ex: 300g), calcule les valeurs pour cette quantité
- Si aucune quantité précisée, estime une portion standard
- Pour les plats composés (ex: pâtes bolognaise), décompose OU donne le total du plat
- Si c'est un produit connu (marque, packaging), utilise les vraies valeurs nutritionnelles
- Si aucun aliment détecté, retourne {"foods":[]}
- Sois précis et réaliste dans tes estimations`;

    let messages;

    if (image) {
      // Image analysis
      messages = [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${mediaType || 'image/jpeg'};base64,${image}` } },
          { type: 'text', text: 'Analyse cette image et identifie TOUS les aliments visibles. Si c\'est un produit emballé, lis les infos nutritionnelles sur l\'emballage. Si un code-barres est visible, identifie le produit.' }
        ]
      }];
    } else {
      // Text analysis
      messages = [{
        role: 'user',
        content: `Analyse cette description d'aliment ou de repas et donne les informations nutritionnelles précises: "${text}"`
      }];
    }

    const visionModels = [
      'llama-3.2-90b-vision-preview',
      'llama-3.2-11b-vision-preview',
      'meta-llama/llama-4-scout-17b-16e-instruct'
    ];

    const textModels = [
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
      'meta-llama/llama-4-scout-17b-16e-instruct'
    ];

    const models = image ? visionModels : textModels;
    let lastError = '';

    for (const model of models) {
      try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: model,
            messages: [
              { role: 'system', content: systemPrompt },
              ...messages
            ],
            temperature: 0.2,
            max_tokens: 1500
          })
        });

        const data = await response.json();
        if (data.error) { lastError = data.error.message || JSON.stringify(data.error); continue; }

        const content = data.choices?.[0]?.message?.content || '';
        if (!content) { lastError = 'No response'; continue; }

        let jsonStr = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
        if (jsonMatch) jsonStr = jsonMatch[0];

        const parsed = JSON.parse(jsonStr);
        return res.status(200).json(parsed);
      } catch (e) { lastError = e.message; continue; }
    }

    return res.status(500).json({ error: lastError || 'All models failed' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to analyze', detail: err.message });
  }
}
