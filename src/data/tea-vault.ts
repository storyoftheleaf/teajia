// Tea inventory markdown files
// Organized by tea type and harvest year
// Prices stored as per-gram and calculated based on selected gram amount

export const TEA_MARKDOWN_FILES = [
  `---
id: "1"
type: "[[Green]]"
name: "Jade Sword"
variant: "Dragon Well"
year: "2024"
origin: "[[Hangzhou, Zhejiang]]"
stock_g: 500
cost_price: 30
price_per_gram: 1.36
tags:
  - "[[Vibrant]]"
  - "[[Energetic]]"
image: "https://picsum.photos/600/600?random=201"
---
Flat, spear-like leaves that dance beautifully in the glass. It carries a distinct orchid aroma with a sweet, nutty finish that lingers on the palate. This harvest captures the essence of the pre-rain season.`,

  `---
id: "2"
type: "[[Green]]"
name: "Spiral Mist"
variant: "Biluochun"
year: "2024"
origin: "[[Suzhou, Jiangsu]]"
stock_g: 250
cost_price: 25
price_per_gram: 1.10
tags:
  - "[[Soft]]"
  - "[[Vibrant]]"
image: "https://picsum.photos/600/600?random=202"
---
Tightly rolled spirals resembling snail shells. The brew is fruity, floral, and incredibly delicate, evoking the mists of Lake Tai. A true testament to the skill of the tea master.`,

  `---
id: "3"
type: "[[Green]]"
name: "White Forest"
variant: "Anji Baicha"
year: "2024"
origin: "[[Anji, Zhejiang]]"
stock_g: 400
cost_price: 35
price_per_gram: 1.44
tags:
  - "[[Meditative]]"
  - "[[Soft]]"
image: "https://picsum.photos/600/600?random=203"
---
Rare pine-needle shape with a pale, jade-white hue. It possesses an extremely high amino acid content, delivering a savory umami broth unlike any other green tea.`,

  `---
id: "4"
type: "[[White]]"
name: "Silver Down"
variant: "Silver Needle"
year: "2023"
origin: "[[Fuding, Fujian]]"
stock_g: 300
cost_price: 40
price_per_gram: 1.70
tags:
  - "[[Meditative]]"
  - "[[Soft]]"
image: "https://picsum.photos/600/600?random=204"
---
Plump, downy buds gathered entirely by hand. Notes of fresh melon sweetness combine with a thick, viscous texture that coats the throat.`,

  `---
id: "5"
type: "[[White]]"
name: "Pale Bloom"
variant: "White Peony"
year: "2023"
origin: "[[Fuding, Fujian]]"
stock_g: 600
cost_price: 15
price_per_gram: 0.90
tags:
  - "[[Soft]]"
  - "[[Balanced]]"
image: "https://picsum.photos/600/600?random=205"
---
A classic bud and leaf set, dried under the sun. Offers a fuller body with notes of dried apricot and autumn leaves. Ideally suited for aging.`,

  `---
id: "6"
type: "[[White]]"
name: "Night Breeze"
variant: "Moonlight White"
year: "2023"
origin: "[[Yunnan]]"
stock_g: 800
cost_price: 12
price_per_gram: 0.70
tags:
  - "[[Romantic]]"
  - "[[Soft]]"
image: "https://picsum.photos/600/600?random=206"
---
Air-dried indoors to preserve its dark upper leaf and white fuzzy underside. Smooth, sweet, and devoid of bitterness, it darkens beautifully with age.`,

  `---
id: "7"
type: "[[Yellow]]"
name: "Golden Needle"
variant: "Junshan Yinzhen"
year: "2024"
origin: "[[Hunan]]"
stock_g: 100
cost_price: 60
price_per_gram: 2.40
tags:
  - "[[Meditative]]"
  - "[[Ancient]]"
image: "https://picsum.photos/600/600?random=207"
---
The rarest tea type, processed with a unique 'sealing yellow' step. It yields a golden hue with a unique corn-like sweetness and heavy mouthfeel.`,

  `---
id: "8"
type: "[[Oolong]]"
name: "Crimson Robe"
variant: "Da Hong Pao"
year: "2023"
origin: "[[Wuyi Mt, Fujian]]"
stock_g: 450
cost_price: 45
price_per_gram: 1.90
tags:
  - "[[Grounding]]"
  - "[[Strong]]"
image: "https://picsum.photos/600/600?random=208"
---
A high-roast cliff tea from the heart of Wuyi. It delivers the famous 'Yan Yun' mineral sensation, layered with stone fruit and charcoal notes. Powerful and grounding.`,

  `---
id: "9"
type: "[[Oolong]]"
name: "Iron Mercy"
variant: "Tieguanyin"
year: "2023"
origin: "[[Anxi, Fujian]]"
stock_g: 800
cost_price: 10
price_per_gram: 0.70
tags:
  - "[[Balanced]]"
  - "[[Soft]]"
image: "https://picsum.photos/600/600?random=209"
---
Processed using traditional roasting techniques rather than the modern green style. It is floral yet creamy, with a lingering finish that returns after every sip.`,

  `---
id: "10"
type: "[[Oolong]]"
name: "Honey Orchid"
variant: "Phoenix Dancong"
year: "2023"
origin: "[[Chaozhou, Guangdong]]"
stock_g: 200
cost_price: 30
price_per_gram: 1.50
tags:
  - "[[Vibrant]]"
  - "[[Energetic]]"
image: "https://picsum.photos/600/600?random=210"
---
Harvested from a single grove of old trees. The tea explodes with an intense natural lychee and honey aroma. A vibrant tea that demands attention.`,

  `---
id: "11"
type: "[[Oolong]]"
name: "Peak Dew"
variant: "Alishan"
year: "2023"
origin: "[[Chiayi, Taiwan]]"
stock_g: 600
cost_price: 20
price_per_gram: 1.00
tags:
  - "[[Vibrant]]"
  - "[[Soft]]"
image: "https://picsum.photos/600/600?random=211"
---
Grown at 1400m in the high mountains of Taiwan. The cool mist creates a creamy texture and a clean, sweet floral nose.`,

  `---
id: "12"
type: "[[Black]]"
name: "Smoke Pine"
variant: "Lapsang Souchong"
year: "2023"
origin: "[[Wuyi Mt, Fujian]]"
stock_g: 350
cost_price: 15
price_per_gram: 0.80
tags:
  - "[[Grounding]]"
  - "[[Ancient]]"
image: "https://picsum.photos/600/600?random=212"
---
The original black tea, smoked over pinewood fires. It offers a resinous sweetness with distinct notes of pine, dried longan, and campfires.`,

  `---
id: "13"
type: "[[Black]]"
name: "Golden Fleece"
variant: "Dian Hong"
year: "2024"
origin: "[[Fengqing, Yunnan]]"
stock_g: 1200
cost_price: 10
price_per_gram: 0.56
tags:
  - "[[Grounding]]"
  - "[[Strong]]"
image: "https://picsum.photos/600/600?random=213"
---
Composed almost entirely of golden tips. This tea is malty with sweet potato notes and is very forgiving to brew. A comforting daily cup.`,

  `---
id: "14"
type: "[[Black]]"
name: "Horse Brow"
variant: "Jin Jun Mei"
year: "2024"
origin: "[[Wuyi Mt, Fujian]]"
stock_g: 150
cost_price: 80
price_per_gram: 3.60
tags:
  - "[[Soft]]"
  - "[[Romantic]]"
image: "https://picsum.photos/600/600?random=214"
---
Crafted from thousands of tiny golden buds. It presents an intricate complexity of honey, chocolate, and roses. The texture is like silk.`,

  `---
id: "15"
type: "[[Dark]]"
name: "Dark Earth"
variant: "Ripe Pu-erh"
year: "2015"
origin: "[[Menghai, Yunnan]]"
stock_g: 5000
cost_price: 25
price_per_gram: 1.30
tags:
  - "[[Grounding]]"
  - "[[Meditative]]"
image: "https://picsum.photos/600/600?random=215"
---
Fermented to perfection, creating a deep, dark liquor. Earthy, smooth, and woody, it provides a calming energy ideal for digestion.`,

  `---
id: "16"
type: "[[Dark]]"
name: "Ancient Spirit"
variant: "Raw Pu-erh"
year: "2012"
origin: "[[Yiwu, Yunnan]]"
stock_g: 400
cost_price: 120
price_per_gram: 5.60
tags:
  - "[[Wild]]"
  - "[[Energetic]]"
image: "https://picsum.photos/600/600?random=216"
---
Harvested from ancient arbor trees and naturally aged. It possesses a complex, vibrant energy (Cha Qi) with notes of plum and camphor.`,

  `---
id: "17"
type: "[[Dark]]"
name: "River Basket"
variant: "Liu Bao"
year: "2010"
origin: "[[Guangxi]]"
stock_g: 1500
cost_price: 15
price_per_gram: 0.90
tags:
  - "[[Ancient]]"
  - "[[Grounding]]"
image: "https://picsum.photos/600/600?random=217"
---
Aged in large bamboo baskets, allowing it to breathe. It develops a unique betel nut and wet wood profile with a distinct cooling sensation.`,

  `---
id: "18"
type: "[[Herbal]]"
name: "Pearl Scent"
variant: "Jasmine Pearls"
year: "2023"
origin: "[[Fuzhou, Fujian]]"
stock_g: 1000
cost_price: 10
price_per_gram: 0.60
tags:
  - "[[Romantic]]"
  - "[[Soft]]"
image: "https://picsum.photos/600/600?random=218"
---
Premium green tea scented seven times with fresh jasmine flowers. Each pearl is hand-rolled to lock in the aroma until brewing.`,

  `---
id: "19"
type: "[[Herbal]]"
name: "Kunlun Snow"
variant: "Snow Chrysanthemum"
year: "2023"
origin: "[[Kunlun Mt, Xinjiang]]"
stock_g: 300
cost_price: 15
price_per_gram: 0.80
tags:
  - "[[Meditative]]"
  - "[[Soft]]"
image: "https://picsum.photos/600/600?random=219"
---
A rare high-altitude flower that produces a deep red liquor. It tastes of honey and caramel, known for its soothing properties.`,

  `---
id: "20"
type: "[[Oolong]]"
name: "Silver Flower"
variant: "Duck Shit Dancong"
year: "2023"
origin: "[[Phoenix Mt, Guangdong]]"
stock_g: 300
cost_price: 28
price_per_gram: 1.30
tags:
  - "[[Vibrant]]"
  - "[[Wild]]"
image: "https://picsum.photos/600/600?random=220"
---
Don't let the traditional name (Ya Shi Xiang) fool you. Grown in yellow soil, this tea offers the most intense, perfume-like honeysuckle aroma of all Dancongs.`,

  `---
id: "21"
type: "[[Green]]"
name: "Melon Seed"
variant: "Lu An Gua Pian"
year: "2024"
origin: "[[Anhui]]"
stock_g: 400
cost_price: 22
price_per_gram: 1.16
tags:
  - "[[Strong]]"
  - "[[Vegetal]]"
image: "https://picsum.photos/600/600?random=221"
---
The only green tea made entirely from leaves without buds or stems. It has a robust, toasted sunflower seed flavor with a heavy sweetness.`,

  `---
id: "22"
type: "[[Black]]"
name: "Sun Dried Red"
variant: "Shai Hong"
year: "2023"
origin: "[[Yunnan]]"
stock_g: 1000
cost_price: 15
price_per_gram: 0.64
tags:
  - "[[Soft]]"
  - "[[Romantic]]"
image: "https://picsum.photos/600/600?random=222"
---
A black tea that is sun-dried rather than roasted. It retains active enzymes, allowing it to age like a raw Pu-erh. Notes of dried tropical fruits and hibiscus.`,

  `---
id: "23"
type: "[[White]]"
name: "Autumn Leaf"
variant: "Aged Shou Mei"
year: "2018"
origin: "[[Fuding, Fujian]]"
stock_g: 600
cost_price: 18
price_per_gram: 0.84
tags:
  - "[[Grounding]]"
  - "[[Medicinal]]"
image: "https://picsum.photos/600/600?random=223"
---
Pressed into a cake in 2018. The years have transformed the fresh herbal notes into a deep, medicinal jujube and date sweetness.`,

  `---
id: "24"
type: "[[Oolong]]"
name: "Amber GABA"
variant: "GABA Oolong"
year: "2023"
origin: "[[Nantou, Taiwan]]"
stock_g: 500
cost_price: 25
price_per_gram: 1.10
tags:
  - "[[Calming]]"
  - "[[Soft]]"
image: "https://picsum.photos/600/600?random=224"
---
Processed in a nitrogen-rich environment to boost GABA content. It has a distinct baked sweet potato and raisin flavor, known for its relaxing properties.`
];
