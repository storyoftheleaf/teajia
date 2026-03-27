import { ContentType } from '../../types';
import { ReadableStory } from '../../types/read';
import { PEOPLE } from '../people';

export const artistInterview: ReadableStory = {
  id: 'template-artist-interview',
  type: ContentType.Article,
  status: 'vault',
  title: 'Artist Interview',
  subtitle: 'The Ceramicist',
  thumbnailUrl: 'https://images.unsplash.com/photo-1530968033775-2c92736b131e?w=800&h=1200&fit=crop',
  durationOrTime: '17 Pages',
  origin: 'In-house',
  description: 'An artist profile combining studio photography, creative process documentation, and philosophical dialogue.',
  tags: ['Culture', 'Pottery'],
  category: 'interview',
  content: [
    ":::COVER_SPLIT:::Master Lin|The Ceramicist|https://images.unsplash.com/photo-1530968033775-2c92736b131e?w=800&h=1200&fit=crop",

    ":::TEXT_DROP_CAP:::Master Lin's studio occupies a converted rice barn on the outskirts of Yixing, in Jiangsu Province, where the Zisha clay deposits that have supplied China's most celebrated teapot makers for over five centuries lie just beneath the surface of the surrounding hills. The building is unremarkable from outside — corrugated metal roof, concrete walls, a wooden door that sticks in humid weather.",

    ":::TEXT_SIDEBAR_IMAGE:::Inside, it is a world of ordered intensity. Clay in various stages of preparation lines one wall: raw chunks of Zini, Zhuni, and Duanni sorted by color and density. A massive wooden wedging table dominates the center of the room, its surface worn smooth by decades of use. Shelves hold hundreds of pieces — finished pots, experiments, failures that Lin keeps as teaching tools, and works-in-progress that may sit for months before he decides how to complete them.|Master Lin's studio interior|https://images.unsplash.com/photo-1530968033775-2c92736b131e?w=800&h=1200&fit=crop",

    ":::TEXT_SINGLE_COL:::The air smells of wet earth and the faint, sweet smoke of a wood-fired kiln that stands in the courtyard, cooling from a firing completed the previous night.",

    ":::IMG_FULL_BLEED:::Master Lin at his wedging table, working a block of aged Zini clay into the consistency required for slab construction|https://images.unsplash.com/photo-1597318181409-cf64d0b5d8a2?w=800&h=1200&fit=crop",

    ":::MAGAZINE_INTERVIEW_Q_A:::Chen|Master Lin, your family has been working with Yixing clay for generations. When did you know this would be your path?\n\nLin|I did not choose this path. The path chose me, or more accurately, the clay chose me. My grandfather was a potter. My father was a potter. When I was five or six years old, I would sit in my grandfather's workshop and play with clay scraps while he worked. I was not learning — or so I thought. But my hands were learning. By the time I was ten, I could wedge clay properly. By fifteen, I could throw a basic pot on the wheel, though my grandfather did not use a wheel — he was a purist who built everything by hand using the traditional slab-and-paddle method.",

    ":::IMG_WITH_CAPTION_BOTTOM:::The Yixing clay landscape — ancient deposits beneath gentle hills|https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800&h=1200&fit=crop",

    ":::MAGAZINE_INTERVIEW_Q_A:::Chen|You tried to leave the craft at one point?\n\nLin|I tried to leave. I went to university in Nanjing to study engineering. I lasted two semesters. My hands ached to work with clay. I would find myself kneading my eraser during lectures, forming it into miniature vessels. My professor noticed and told me, gently, that I was in the wrong place. He was right.\n\nChen|What distinguishes Yixing Zisha clay from other ceramic materials?\n\nLin|Everything. Zisha is not clay in the ordinary sense. It is a sedimentary mineral deposit — a mixture of quartz, kaolin, and mica with a unique particle structure that makes it naturally porous. When you fire Zisha between 1100 and 1200 degrees Celsius, the quartz particles form a scaffold that traps millions of microscopic air pockets.",

    ":::QUOTE_MINIMAL:::Pour boiling water through a well-used Zisha pot that has brewed Da Hong Pao for thirty years, and the water will come out tasting of tea. No other ceramic material does this.",

    ":::TEXT_CENTER_NARROW:::It is the difference between a vessel that holds tea and a vessel that participates in tea. This is what makes Zisha extraordinary — not its beauty, though it is beautiful, but its capacity for memory.",

    ":::IMG_GRID_2x2:::Four stages of Lin's process: selecting raw clay from his personal stockpile, wedging on the ancient table, hand-building using slab technique, the finished pot before firing|https://images.unsplash.com/photo-1530968033775-2c92736b131e?w=800&h=1200&fit=crop",

    ":::TEXT_SIDEBAR_RIGHT:::The Three Clays|Yixing Zisha exists in three primary varieties, each with distinct properties. Zini (purple clay) is the most common and versatile, firing to a range of browns and purples. It is slightly porous and suits most tea types. Zhuni (vermillion clay) is rarer and fires to a brilliant orange-red. Its finer particle structure creates a denser pot with crisper heat retention — ideal for high-fired oolongs. Duanni (yellow clay) has the coarsest texture and highest porosity, making it well-suited to aged teas and puerh that benefit from maximum air exchange. Master Lin works with all three but has a particular affinity for aged Zini — clay that has been mined and then stored, exposed to weather, for decades before use. 'Aged clay is more forgiving,' he says. 'It has had time to settle into itself.'|https://images.unsplash.com/photo-1563911892437-1feda0179e1b?w=800&h=1200&fit=crop",

    ":::QUOTE_BIG:::A pot is not an object. It is a relationship — between the clay and the fire, between the maker and the material, between the vessel and the tea it will hold for the rest of its life.",

    ":::MAGAZINE_INTERVIEW_Q_A:::Chen|Can you walk us through how you make a teapot?\n\nLin|I will describe the traditional Yixing method, which I follow without significant modification. First, I select the clay. This is not a casual decision — I may spend an hour examining different blocks, testing their moisture content, their plasticity, their color when scratched. The clay determines the pot's character before I have shaped a single form.",

    ":::IMG_FULL_BLEED:::Hands shaping clay in the traditional slab-and-paddle method|https://images.unsplash.com/photo-1597318181409-cf64d0b5d8a2?w=800&h=1200&fit=crop",

    ":::MAGAZINE_INTERVIEW_Q_A:::Chen|And then the forming process?\n\nLin|Then I wedge — kneading the clay to distribute moisture evenly and remove air pockets. My grandfather taught me that you should wedge at least one hundred times. I usually do three hundred. Then I roll the clay into slabs of even thickness using a wooden paddle and a rolling pin. The body of the pot is formed by wrapping a slab around a wooden cylinder and joining the seam. The bottom is cut from a flat slab and fitted. The lid is formed separately and fitted to the body with extreme precision — a good Yixing lid should create an airtight seal without any grinding or adjustment. The spout and handle are formed by hand. The entire process takes one to three days depending on the complexity of the form.\n\nChen|And the firing?\n\nLin|I fire in my wood kiln, which I built myself twenty years ago. A full firing takes thirty-six hours. The first twelve hours are slow — I am gradually raising the temperature, driving out moisture and pre-heating the clay. Then I begin the main firing, pushing to 1150 degrees for Zini, higher for Zhuni. The last four hours are critical — this is where the clay vitrifies and the surface develops its final texture. I do not use a pyrometer. I judge temperature by the color of the flame and the glow of the clay.",

    ":::QUOTE_MINIMAL:::My grandfather used to say that a tea maker listens to the kettle and a potter watches the fire. The fire speaks to you if you are patient enough to learn its language.",

    ":::IMG_FILM_STRIP_VERTICAL:::A sequence from Lin's studio: the slow, deliberate rhythm of hand-building a teapot from slab to finished form|https://images.unsplash.com/photo-1530968033775-2c92736b131e?w=800&h=1200&fit=crop",

    ":::TEXT_DOUBLE_COL:::On Form and Function|'Every design decision I make serves the tea,' Lin explains, holding up a small round pot — a Xi Shi shape, perhaps 120 milliliters, in deep brown Zini. 'This shape — the round body, the short spout, the small opening — is designed for rolled oolongs. The round interior gives the leaves room to expand fully. The short spout pours quickly, which is important for gongfu brewing where seconds matter. The small opening concentrates aroma.'\n\nOn Imperfection|'Western pottery values perfect symmetry. Japanese pottery, through the wabi-sabi tradition, values visible imperfection. Yixing pottery occupies a middle ground. I strive for precision — the lid must fit perfectly, the spout must pour cleanly, the handle must be comfortable. But within that precision, I welcome the marks of the hand. The slight variation in wall thickness, the fingerprint in the clay that I choose not to smooth away — these imperfections are not flaws. They are evidence of presence.'",

    ":::IMG_ARCH_MASK:::A finished Xi Shi pot in aged Zini clay, the surface showing the subtle granular texture that distinguishes genuine Yixing ware|https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?w=800&h=1200&fit=crop",

    ":::TEXT_SIDEBAR_LEFT:::The Crisis of Authenticity|Master Lin is candid about the challenges facing Yixing pottery today. 'The market is flooded with fakes,' he says. 'Machine-made pots from Guangdong, chemical-treated clay that imitates the color of aged Zisha, factory pieces stamped with the seals of famous masters. Eighty percent of what is sold as Yixing Zisha online is not genuine. The consumer cannot tell the difference from a photograph.'|https://images.unsplash.com/photo-1530968033775-2c92736b131e?w=800&h=1200&fit=crop",

    ":::TEXT_CENTER_NARROW:::'This is not just a problem of commerce — it is a problem of culture. When people buy a fake Yixing pot, have a bad experience because the clay does not breathe properly and the tea tastes wrong, they conclude that Yixing ware is overrated. The fraud undermines the tradition itself.'",

    ":::IMG_WITH_CAPTION_BOTTOM:::Ancient Yixing teapots seasoned over decades of daily use|https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?w=800&h=1200&fit=crop",

    ":::MAGAZINE_INTERVIEW_Q_A:::Chen|What is the relationship between a pot and the tea it serves?\n\nLin|It is a marriage. And like any marriage, it deepens over time. When you dedicate a Zisha pot to a single type of tea — say, Wuyi Yan Cha — the clay slowly absorbs the tea's essential oils. After a hundred sessions, a thousand sessions, the pot has developed its own seasoning, its own voice. It does not merely contain the tea; it shapes it, adds to it, contributes its accumulated memory of every previous session.",

    ":::MAGAZINE_INTERVIEW_Q_A:::Chen|You have pots in your collection that are over a century old. What is it like to brew with them?\n\nLin|[He pauses, choosing his words carefully.] It is like speaking with an ancestor. The pot carries the accumulated experience of every person who has brewed in it, every tea that has passed through it. When I pour water into my great-grandfather's pot — a small Shui Ping shape that he used exclusively for Tie Guan Yin — I can sense the depth of its seasoning. The tea that emerges is richer, rounder, more complete than the same tea brewed in a new pot. There is something in the experience that transcends chemistry — a sense of continuity, of time compressed into a single cup.",

    ":::IMG_POLAROID_SCATTER:::Moments from the studio: Lin's collection of antique pots, a shelf of raw clay samples, tea stains on the wedging table, sunlight through the workshop window|https://images.unsplash.com/photo-1530968033775-2c92736b131e?w=800&h=1200&fit=crop",

    ":::TEXT_DOUBLE_COL:::On Teaching|'I take one or two students at a time,' Lin says. 'The traditional apprenticeship lasted three years. Mine last five. The first year, the student does nothing but prepare clay — mining, weathering, wedging. They do not touch a forming tool. This frustrates modern students who want to make pots immediately. But preparing clay is the foundation of everything.'\n\nOn the Future|'People ask me if Yixing pottery will survive. I think the better question is: will the culture that values Yixing pottery survive? A Zisha pot makes sense only in a world where people take time for tea. But I see a counter-movement — young people in Shanghai, in Taipei, even in New York and London, rediscovering the slowness of gongfu tea. They come to my studio wanting to understand. That gives me hope.'",

    ":::EPILOGUE_CENTERED:::Master Lin continues to work from his studio in Yixing, producing a small number of pieces each year. He fires his wood kiln approximately once a month during the cooler seasons. His pots are sold through personal relationships and a small number of trusted tea shops in China and Taiwan. He does not have a website and does not intend to create one. 'The pot finds the person who needs it,' he says. 'It always has.'",

    ":::COPYRIGHT_PAGE:::Interview by Chen Wei\nPhotography by Li Jun\nTeajia Journal — Voices in Tea"
  ],
  author: PEOPLE.chen,
  interviewee: PEOPLE.lin,
};
