/**
 * Comprehensive tea variety database organized by main category (TeaType).
 * Powers autocomplete in the Tea Compass capture card.
 *
 * - `name`        Primary English display name
 * - `chineseName` Chinese characters — auto-filled into the chineseName field on select
 * - `altNames`    Alternative romanizations / spelling variants for matching
 * - `region`      Typical origin — auto-filled into the region field on select
 */

import type { TeaType } from '../components/TeaCompass/types';

export interface TeaVariety {
  name: string;
  chineseName?: string;
  altNames?: string[];
  region?: string;
}

export const TEA_VARIETIES: Record<Exclude<TeaType, 'Teaware'>, TeaVariety[]> = {

  // ─────────────────────────────────────────────────────────────────────────
  // GREEN
  // ─────────────────────────────────────────────────────────────────────────
  Green: [
    // China — Zhejiang
    { name: 'Longjing',          chineseName: '龙井',     altNames: ['Dragon Well', 'Long Jing'],          region: 'Hangzhou' },
    { name: 'Biluochun',         chineseName: '碧螺春',   altNames: ['Pi Lo Chun', 'Bi Luo Chun'],         region: 'Suzhou' },
    { name: 'Anji Bai Cha',      chineseName: '安吉白茶', altNames: ['Anji White Tea'],                    region: 'Anji' },
    { name: 'Mo Gan Huang Ya',   chineseName: '莫干黄芽',                                                  region: 'Zhejiang' },
    { name: 'Zhu Cha',           chineseName: '珠茶',     altNames: ['Gunpowder'],                         region: 'Zhejiang' },
    { name: 'Chun Mee',          chineseName: '珍眉',     altNames: ['Zhenmei', 'Pearl Eyebrow'] },
    { name: 'Young Hyson',       chineseName: '熙春' },

    // China — Anhui
    { name: 'Huang Shan Mao Feng', chineseName: '黄山毛峰', altNames: ['Huangshan Mao Feng'],              region: 'Huangshan' },
    { name: 'Tai Ping Hou Kui',  chineseName: '太平猴魁', altNames: ['Monkey King'],                       region: 'Taiping' },
    { name: 'Liu An Gua Pian',   chineseName: '六安瓜片', altNames: ['Melon Seed Tea'],                    region: "Lu'an" },
    { name: 'Ding Gu Da Fang',   chineseName: '顶谷大方',                                                  region: 'Anhui' },

    // China — Jiangsu
    { name: 'Nanjing Yuhua',     chineseName: '南京雨花茶', altNames: ['Rain Flower Tea'],                 region: 'Nanjing' },

    // China — Henan
    { name: 'Xinyang Mao Jian',  chineseName: '信阳毛尖',                                                  region: 'Xinyang' },

    // China — Guizhou
    { name: 'Duyun Mao Jian',    chineseName: '都匀毛尖',                                                  region: 'Guizhou' },

    // China — Sichuan
    { name: 'Mengding Gan Lu',   chineseName: '蒙顶甘露', altNames: ['Sweet Dew'],                         region: "Ya'an" },
    { name: 'Mengding Xian Cha', chineseName: '蒙顶仙茶',                                                  region: "Ya'an" },
    { name: 'Zhu Ye Qing',       chineseName: '竹叶青',   altNames: ['Bamboo Leaf Green'],                 region: 'Emei Mountain' },

    // China — Jiangxi
    { name: 'Lu Shan Yun Wu',    chineseName: '庐山云雾', altNames: ['Cloud Mist'],                        region: 'Lushan' },

    // China — Hubei
    { name: 'Enshi Yu Lu',       chineseName: '恩施玉露', altNames: ['Jade Dew'],                          region: 'Enshi' },
    { name: 'Yuan An Lu Yuan',   chineseName: '远安鹿苑',                                                  region: "Yuan'an" },

    // Generic / regional terms
    { name: 'Mao Jian',          chineseName: '毛尖',     altNames: ['Hair Tip'] },
    { name: 'Mao Feng',          chineseName: '毛峰',     altNames: ['Fur Peak'] },
    { name: 'Que She',           chineseName: '雀舌',     altNames: ['Sparrow Tongue'] },
    { name: 'Ya Bao',            chineseName: '芽苞',     altNames: ['Wild Yunnan Buds'],                  region: 'Yunnan' },

    // Japan
    { name: 'Gyokuro',           chineseName: '玉露',     altNames: ['Jade Dew'],                          region: 'Uji' },
    { name: 'Sencha',            chineseName: '煎茶' },
    { name: 'Shincha',           chineseName: '新茶',     altNames: ['New Tea', 'First Harvest'] },
    { name: 'Kabusecha',         chineseName: 'かぶせ茶', altNames: ['Covered Tea'] },
    { name: 'Tencha',            chineseName: '碾茶' },
    { name: 'Matcha',            chineseName: '抹茶',                                                      region: 'Uji' },
    { name: 'Genmaicha',         chineseName: '玄米茶',   altNames: ['Brown Rice Tea'] },
    { name: 'Hojicha',           chineseName: 'ほうじ茶', altNames: ['Roasted Green Tea'] },
    { name: 'Bancha',            chineseName: '番茶' },
    { name: 'Kukicha',           chineseName: '茎茶',     altNames: ['Twig Tea', 'Bocha'] },
    { name: 'Tamaryokucha',      chineseName: '玉緑茶',   altNames: ['Guricha'] },
    { name: 'Kamairicha',        chineseName: '釜炒り茶', altNames: ['Pan-fired Green'] },
    { name: 'Konacha',           chineseName: '粉茶',     altNames: ['Powder Tea'] },
    { name: 'Ichibancha',        chineseName: '一番茶',   altNames: ['First Harvest Sencha'] },
    { name: 'Yame Gyokuro',                               altNames: ['Fukuoka Gyokuro'],                   region: 'Yame' },

    // Korea
    { name: 'Ujeon',             chineseName: '雨前',     altNames: ['Pre-Rain Korean Green'],             region: 'Boseong' },
    { name: 'Sejak',                                       altNames: ['Second Flush Korean Green'],         region: 'Boseong' },
    { name: 'Jungjak',                                     altNames: ['Third Flush Korean Green'],          region: 'Boseong' },
    { name: 'Hadong Green',                                                                                 region: 'Hadong' },
    { name: 'Jeju Green',                                                                                   region: 'Jeju' },

    // Other origins
    { name: 'Darjeeling Green',                                                                             region: 'Darjeeling' },
    { name: 'Nepal Green',                                                                                  region: 'Nepal' },
    { name: 'Vietnam Green',                                                                                region: 'Vietnam' },
    { name: 'Ceylon Green',                                                                                 region: 'Sri Lanka' },
    { name: 'Moroccan Mint',                               altNames: ['Touareg Tea', 'Maghrebi Mint'] },
    { name: 'Georgia Green',                                                                                region: 'Georgia' },
  ],

  // ─────────────────────────────────────────────────────────────────────────
  // WHITE
  // ─────────────────────────────────────────────────────────────────────────
  White: [
    { name: 'Bai Hao Yin Zhen',  chineseName: '白毫银针', altNames: ['Silver Needle'],                     region: 'Fuding' },
    { name: 'Bai Mu Dan',        chineseName: '白牡丹',   altNames: ['White Peony', 'Pai Mu Tan'],         region: 'Fujian' },
    { name: 'Gong Mei',          chineseName: '贡眉',     altNames: ['Tribute Eyebrow'],                   region: 'Fujian' },
    { name: 'Shou Mei',          chineseName: '寿眉',     altNames: ['Longevity Eyebrow'],                 region: 'Fujian' },
    { name: 'Yue Guang Bai',     chineseName: '月光白',   altNames: ['Moonlight White', 'Moonlight Beauty'], region: 'Yunnan' },
    { name: 'Fuding White',      chineseName: '福鼎白茶', altNames: ['Fuding Bai Cha'],                    region: 'Fuding' },
    { name: 'Zhenghe White',     chineseName: '政和白茶', altNames: ['Zhenghe Bai Cha'],                   region: 'Zhenghe' },
    { name: 'Yunnan White',      chineseName: '云南白茶',                                                  region: 'Yunnan' },
    { name: 'Aged White',        chineseName: '老白茶',   altNames: ['Lao Bai Cha', 'Old White Tea'] },
    { name: 'Yunnan Ancient Tree White', chineseName: '云南古树白茶',                                      region: 'Yunnan' },
    { name: 'Bohe Hao',          chineseName: '博贺号',                                                    region: 'Guangdong' },
    { name: 'Darjeeling White',                                                                             region: 'Darjeeling' },
    { name: 'Ceylon White',                                                                                 region: 'Sri Lanka' },
    { name: 'Kenya White',                                                                                  region: 'Kenya' },
    { name: 'Nepal White',                                                                                  region: 'Nepal' },
  ],

  // ─────────────────────────────────────────────────────────────────────────
  // YELLOW
  // ─────────────────────────────────────────────────────────────────────────
  Yellow: [
    { name: 'Jun Shan Yin Zhen',   chineseName: '君山银针', altNames: ['Junshan Silver Needle'],           region: 'Junshan' },
    { name: 'Meng Ding Huang Ya',  chineseName: '蒙顶黄芽', altNames: ['Mengding Yellow Bud'],             region: "Ya'an" },
    { name: 'Huo Shan Huang Ya',   chineseName: '霍山黄芽', altNames: ['Huoshan Yellow Bud'],              region: 'Huoshan' },
    { name: 'Ping Yang Huang Tang',chineseName: '平阳黄汤',                                                region: 'Pingyang' },
    { name: 'Huang Tang',          chineseName: '黄汤',                                                    region: 'Zhejiang' },
    { name: 'Guangdong Da Ye Qing',chineseName: '广东大叶青', altNames: ['Large Leaf Green'],              region: 'Guangdong' },
    { name: 'Beigang Mao Jian',    chineseName: '北港毛尖',                                                region: 'Hunan' },
    { name: 'Weishan Mao Jian',    chineseName: '沩山毛尖',                                                region: 'Hunan' },
    { name: 'Yuan An Lu Yuan',     chineseName: '远安鹿苑',                                                region: "Yuan'an" },
    { name: 'Hai Ma Gong',         chineseName: '海马拱',                                                  region: 'Sichuan' },
  ],

  // ─────────────────────────────────────────────────────────────────────────
  // OOLONG
  // ─────────────────────────────────────────────────────────────────────────
  Oolong: [
    // Wuyi Rock Oolongs (Yan Cha)
    { name: 'Da Hong Pao',       chineseName: '大红袍',   altNames: ['Big Red Robe'],                      region: 'Wuyi' },
    { name: 'Rou Gui',           chineseName: '肉桂',     altNames: ['Cassia', 'Cinnamon Oolong'],         region: 'Wuyi' },
    { name: 'Shui Xian',         chineseName: '水仙',     altNames: ['Water Fairy', 'Narcissus'],          region: 'Wuyi' },
    { name: 'Lao Cong Shui Xian',chineseName: '老丛水仙', altNames: ['Old Bush Narcissus'],                region: 'Wuyi' },
    { name: 'Tie Luo Han',       chineseName: '铁罗汉',   altNames: ['Iron Arhat'],                        region: 'Wuyi' },
    { name: 'Bai Ji Guan',       chineseName: '白鸡冠',   altNames: ['White Cockscomb'],                   region: 'Wuyi' },
    { name: 'Shui Jin Gui',      chineseName: '水金龟',   altNames: ['Golden Water Turtle'],               region: 'Wuyi' },
    { name: 'Qi Dan',            chineseName: '奇丹',                                                      region: 'Wuyi' },
    { name: 'Ban Tian Yao',      chineseName: '半天腰',                                                    region: 'Wuyi' },
    { name: 'Bei Dou',           chineseName: '北斗',     altNames: ['Big Dipper'],                        region: 'Wuyi' },
    { name: 'Mei Zhan',          chineseName: '梅占',                                                      region: 'Wuyi' },
    { name: 'Huang Guan Yin',    chineseName: '黄观音',   altNames: ['Yellow Guan Yin'],                   region: 'Wuyi' },
    { name: 'Jin Mu Dan',        chineseName: '金牡丹',   altNames: ['Golden Peony'],                      region: 'Wuyi' },
    { name: 'Huang Mei Gui',     chineseName: '黄玫瑰',   altNames: ['Yellow Rose'],                       region: 'Wuyi' },
    { name: 'Rui Xiang',         chineseName: '瑞香',                                                      region: 'Wuyi' },
    { name: 'Xiao Hong Pao',     chineseName: '小红袍',   altNames: ['Small Red Robe'],                    region: 'Wuyi' },
    { name: 'Wuyi Yancha',       chineseName: '武夷岩茶', altNames: ['Rock Oolong', 'Yan Cha'] },

    // Taiwan — High Mountain
    { name: 'Alishan',           chineseName: '阿里山',   altNames: ['Ali Shan'],                          region: 'Alishan' },
    { name: 'Li Shan',           chineseName: '梨山',     altNames: ['Pear Mountain'],                     region: 'Li Shan' },
    { name: 'Da Yu Ling',        chineseName: '大禹岭',   altNames: ['Dayuling'],                          region: 'Da Yu Ling' },
    { name: 'Shan Lin Xi',       chineseName: '杉林溪',   altNames: ['Cedar Creek'],                       region: 'Nantou' },
    { name: 'Dong Ding',         chineseName: '冻顶',     altNames: ['Tung Ting', 'Frozen Summit'],        region: 'Nantou' },
    { name: 'Li Shan Cui Feng',  chineseName: '梨山翠峰',                                                  region: 'Li Shan' },

    // Taiwan — Cultivars & styles
    { name: 'Jin Xuan',          chineseName: '金萱',     altNames: ['Milk Oolong', 'Golden Daylily'],     region: 'Taiwan' },
    { name: 'Cui Yu',            chineseName: '翠玉',     altNames: ['Jade Oolong'],                       region: 'Taiwan' },
    { name: 'Si Ji Chun',        chineseName: '四季春',   altNames: ['Four Seasons Spring'],               region: 'Taiwan' },
    { name: 'Qingxin',           chineseName: '青心乌龙', altNames: ['Qing Xin', 'Blue Heart'],            region: 'Taiwan' },
    { name: 'Hong Oolong',       chineseName: '红乌龙',                                                    region: 'Taitung' },
    { name: 'Bao Zhong',         chineseName: '包种',     altNames: ['Pouchong', 'Wenshan Pouchong'],      region: 'Wenshan' },
    { name: 'Dong Fang Mei Ren', chineseName: '东方美人', altNames: ['Oriental Beauty', 'Bai Hao', 'Champagne Oolong'], region: 'Hsinchu' },
    { name: 'Muzha Tie Guan Yin',chineseName: '木栅铁观音',                                                region: 'Taipei' },
    { name: 'Taiwan Honey Black', chineseName: '蜜香红茶', altNames: ['Honey Oolong', 'Bug-bitten Oolong'] },

    // Fujian Oolongs
    { name: 'Tie Guan Yin',      chineseName: '铁观音',   altNames: ['Iron Goddess', 'Ti Kuan Yin'],       region: 'Anxi' },
    { name: 'Huang Jin Gui',     chineseName: '黄金桂',   altNames: ['Golden Osmanthus', 'Golden Cassia'], region: 'Anxi' },
    { name: 'Ben Shan',          chineseName: '本山',     altNames: ['Original Mountain'],                 region: 'Anxi' },
    { name: 'Mao Xie',           chineseName: '毛蟹',     altNames: ['Hairy Crab'],                        region: 'Anxi' },
    { name: 'Ruan Zhi',          chineseName: '软枝',     altNames: ['Soft Branch'],                       region: 'Fujian' },

    // Phoenix Dan Cong (Guangdong)
    { name: 'Dan Cong',          chineseName: '单枞',     altNames: ['Phoenix Dan Cong'],                  region: 'Phoenix Mountain' },
    { name: 'Mi Lan Xiang',      chineseName: '蜜兰香',   altNames: ['Honey Orchid Dan Cong'],             region: 'Phoenix Mountain' },
    { name: 'Ya Shi Xiang',      chineseName: '鸭屎香',   altNames: ['Duck Shit Aroma', 'Ya Shi'],         region: 'Phoenix Mountain' },
    { name: 'Huang Zhi Xiang',   chineseName: '黄枝香',   altNames: ['Orange Blossom Dan Cong'],           region: 'Phoenix Mountain' },
    { name: 'Gui Hua Xiang',     chineseName: '桂花香',   altNames: ['Osmanthus Dan Cong'],                region: 'Phoenix Mountain' },
    { name: 'Xing Ren Xiang',    chineseName: '杏仁香',   altNames: ['Almond Dan Cong'],                   region: 'Phoenix Mountain' },
    { name: 'Jiang Hua Xiang',   chineseName: '姜花香',   altNames: ['Ginger Flower Dan Cong'],            region: 'Phoenix Mountain' },
    { name: 'Yu Lan Xiang',      chineseName: '玉兰香',   altNames: ['Magnolia Dan Cong'],                 region: 'Phoenix Mountain' },
    { name: 'Fo Shou',           chineseName: '佛手',     altNames: ['Buddha Hand Dan Cong'],              region: 'Phoenix Mountain' },
    { name: 'Rou Gui Xiang',     chineseName: '肉桂香',   altNames: ['Cinnamon Dan Cong'],                 region: 'Phoenix Mountain' },
    { name: 'Chun Lan Xiang',    chineseName: '春兰香',   altNames: ['Spring Orchid Dan Cong'],            region: 'Phoenix Mountain' },
    { name: 'Tong Tian Xiang',   chineseName: '通天香',                                                    region: 'Phoenix Mountain' },
    { name: 'Song Zhong',        chineseName: '宋种',     altNames: ['Song Variety'],                      region: 'Phoenix Mountain' },
    { name: 'Lao Cong Dan Cong', chineseName: '老丛单枞', altNames: ['Old Bush Dan Cong'],                 region: 'Phoenix Mountain' },
    { name: 'Guangdong Shui Xian',chineseName: '广东水仙',                                                 region: 'Guangdong' },

    // Other origins
    { name: 'Darjeeling Oolong',                                                                            region: 'Darjeeling' },
    { name: 'Nepal Oolong',                                                                                 region: 'Nepal' },
    { name: 'Vietnam Oolong',                                                                               region: 'Vietnam' },
    { name: 'Bao Loc Oolong',                                                                              region: 'Bao Loc' },
    { name: 'Thailand Oolong',                                                                              region: 'Doi Mae Salong' },
    { name: 'Doi Mae Salong',                                                                               region: 'Chiang Rai' },
  ],

  // ─────────────────────────────────────────────────────────────────────────
  // RED (called "Black" in Western tradition)
  // ─────────────────────────────────────────────────────────────────────────
  Red: [
    // China — Fujian
    { name: 'Jin Jun Mei',       chineseName: '金骏眉',   altNames: ['Golden Eyebrow'],                    region: 'Wuyi' },
    { name: 'Yin Jun Mei',       chineseName: '银骏眉',   altNames: ['Silver Eyebrow'],                    region: 'Wuyi' },
    { name: 'Tong Jun Mei',      chineseName: '铜骏眉',   altNames: ['Bronze Eyebrow'],                    region: 'Wuyi' },
    { name: 'Lapsang Souchong',  chineseName: '正山小种', altNames: ['Zheng Shan Xiao Zhong', 'Smoky Black'], region: 'Wuyi' },
    { name: 'Tan Yang Gong Fu',  chineseName: '坦洋工夫',                                                  region: 'Fujian' },
    { name: 'Zhenghe Gong Fu',   chineseName: '政和工夫',                                                  region: 'Zhenghe' },
    { name: 'Bai Lin Gong Fu',   chineseName: '白琳工夫',                                                  region: 'Fuding' },

    // China — Anhui
    { name: 'Keemun',            chineseName: '祁门红茶', altNames: ['Qi Men Hong Cha', 'Qimen'],          region: 'Qimen' },
    { name: 'Keemun Mao Feng',   chineseName: '祁门毛峰',                                                  region: 'Qimen' },
    { name: 'Keemun Hao Ya',     chineseName: '祁门毫芽',                                                  region: 'Qimen' },
    { name: 'Keemun Gong Fu',    chineseName: '祁门工夫',                                                  region: 'Qimen' },

    // China — Yunnan
    { name: 'Dianhong',          chineseName: '滇红',     altNames: ['Yunnan Red', 'Dian Hong'],           region: 'Yunnan' },
    { name: 'Dianhong Mao Feng', chineseName: '滇红毛峰',                                                  region: 'Yunnan' },
    { name: 'Dianhong Gold Tips',chineseName: '滇红金芽', altNames: ['Golden Tips Yunnan'],                region: 'Yunnan' },
    { name: 'Classic 58',        chineseName: '经典58',   altNames: ['Dian Hong Classic 58'],              region: 'Yunnan' },
    { name: 'Yunnan Wild Arbor Red', chineseName: '云南古树红茶', altNames: ['Ancient Tree Red'],          region: 'Yunnan' },
    { name: 'Golden Monkey',     chineseName: '金猴',     altNames: ['Jin Hou', 'Golden Tips'] },
    { name: 'Dian Hong Gong Fu', chineseName: '滇红工夫',                                                  region: 'Yunnan' },

    // China — Guangdong
    { name: 'Ying De Hong',      chineseName: '英德红茶', altNames: ['Yingde Red'],                        region: 'Yingde' },

    // China — Zhejiang
    { name: 'Jiu Qu Hong Mei',   chineseName: '九曲红梅', altNames: ['Nine Curve Red Plum'],               region: 'Zhejiang' },

    // China — Sichuan
    { name: 'Sichuan Gong Fu',   chineseName: '川红工夫',                                                  region: 'Sichuan' },

    // Taiwan
    { name: 'Ruby 18',           chineseName: '红玉',     altNames: ['Hong Yu', 'Red Jade'],               region: 'Sun Moon Lake' },
    { name: 'Sun Moon Lake Black',chineseName: '日月潭红茶', altNames: ['Assam Taiwan'],                   region: 'Sun Moon Lake' },
    { name: 'Taiwan Honey Red',  chineseName: '蜜香红茶',                                                  region: 'Taiwan' },

    // India
    { name: 'Darjeeling',                                  altNames: ['Darjeeling Black'],                 region: 'Darjeeling' },
    { name: 'Darjeeling First Flush',                                                                       region: 'Darjeeling' },
    { name: 'Darjeeling Second Flush',                                                                      region: 'Darjeeling' },
    { name: 'Darjeeling Autumnal',                                                                          region: 'Darjeeling' },
    { name: 'Assam',                                       altNames: ['CTC Assam', 'Assam Orthodox'],      region: 'Assam' },
    { name: 'Nilgiri',                                                                                      region: 'Nilgiri' },
    { name: 'Doke',                                        altNames: ['Doke Rolling Thunder'],              region: 'Doke' },
    { name: 'Sikkim',                                                                                       region: 'Sikkim' },
    { name: 'Meghalaya',                                                                                    region: 'Meghalaya' },
    { name: "Margaret's Hope",                                                                              region: 'Darjeeling' },
    { name: 'Makaibari',                                                                                    region: 'Darjeeling' },

    // Sri Lanka
    { name: 'Ceylon',                                      altNames: ['Sri Lanka Black'] },
    { name: 'Nuwara Eliya',                                                                                 region: 'Nuwara Eliya' },
    { name: 'Uva',                                                                                          region: 'Uva' },
    { name: 'Dimbula',                                                                                      region: 'Dimbula' },
    { name: 'Kandy',                                                                                        region: 'Kandy' },

    // Other
    { name: 'Nepal Black',                                                                                  region: 'Nepal' },
    { name: 'Kenya Black',                                                                                  region: 'Kenya' },
    { name: 'Ethiopia Black',                                                                               region: 'Ethiopia' },
    { name: 'Georgian Black',                                                                               region: 'Georgia' },
    { name: 'Turkish Black',                               altNames: ['Rize Cay', 'Turkish Cay'],          region: 'Rize' },
    { name: 'Vietnam Black',                                                                                region: 'Vietnam' },
    { name: 'Japan Black',                                 altNames: ['Wazuka Red', 'Wakoucha'],            region: 'Wazuka' },
    { name: 'Indonesia Black',                             altNames: ['Java Black'],                        region: 'Java' },
  ],

  // ─────────────────────────────────────────────────────────────────────────
  // DARK (Heicha — aged / fermented, non-Puerh)
  // ─────────────────────────────────────────────────────────────────────────
  Dark: [
    // Guangxi
    { name: 'Liu Bao',           chineseName: '六堡茶',   altNames: ['Liubao'],                            region: 'Guangxi' },
    { name: 'Aged Liu Bao',      chineseName: '陈年六堡',                                                  region: 'Guangxi' },

    // Hunan
    { name: 'Fu Zhuan',          chineseName: '茯砖',     altNames: ['Fu Brick', 'Fermented Brick'],       region: 'Hunan' },
    { name: 'Hei Zhuan',         chineseName: '黑砖',     altNames: ['Black Brick'],                       region: 'Hunan' },
    { name: 'Hua Zhuan',         chineseName: '花砖',     altNames: ['Flower Brick'],                      region: 'Hunan' },
    { name: 'Tian Jian',         chineseName: '天尖',     altNames: ['Sky Tip', 'Heaven Tip'],             region: 'Hunan' },
    { name: 'Gong Jian',         chineseName: '贡尖',     altNames: ['Tribute Tip'],                       region: 'Hunan' },
    { name: 'Sheng Jian',        chineseName: '生尖',                                                      region: 'Hunan' },
    { name: 'Qianliang Cha',     chineseName: '千两茶',   altNames: ['Thousand Tael Tea'],                 region: 'Hunan' },
    { name: 'Bai Liang Cha',     chineseName: '百两茶',   altNames: ['Hundred Tael Tea'],                  region: 'Hunan' },
    { name: 'Shi Liang Cha',     chineseName: '十两茶',                                                    region: 'Hunan' },

    // Anhui
    { name: 'Liu An Basket Tea', chineseName: '六安篓茶', altNames: ['Liu An Heicha'],                     region: 'Anhui' },

    // Sichuan / Tibetan
    { name: 'Ya An Tibetan Tea', chineseName: '雅安藏茶', altNames: ['Kangzhuan', 'Ya An Dark Tea'],       region: "Ya'an" },
    { name: 'Sichuan Dark',      chineseName: '四川边茶', altNames: ['Tibetan Brick'],                     region: 'Sichuan' },

    // Yunnan (non-puerh)
    { name: 'Yunnan Dark',       chineseName: '云南黑茶',                                                  region: 'Yunnan' },

    // Stored styles
    { name: 'Malaysian Stored Dark',                       altNames: ['Malaysia-stored Heicha'] },
    { name: 'Hong Kong Stored Dark',                       altNames: ['HK-stored Heicha'] },
  ],

  // ─────────────────────────────────────────────────────────────────────────
  // SHENG PUERH (Raw / Green Puerh)
  // ─────────────────────────────────────────────────────────────────────────
  Sheng: [
    // Yiwu region
    { name: 'Yiwu',              chineseName: '易武',                                                      region: 'Yiwu' },
    { name: 'Gua Feng Zhai',     chineseName: '刮风寨',                                                    region: 'Yiwu' },
    { name: 'Ma Hei',            chineseName: '麻黑',                                                      region: 'Yiwu' },
    { name: 'Ding Jia Zhai',     chineseName: '丁家寨',                                                    region: 'Yiwu' },
    { name: 'Tong Qing He',      chineseName: '铜箐河',                                                    region: 'Yiwu' },
    { name: 'Wan Gong',          chineseName: '弯弓',                                                      region: 'Yiwu' },
    { name: 'Luo Shui Dong',     chineseName: '落水洞',                                                    region: 'Yiwu' },
    { name: 'Man Zhuan',         chineseName: '曼砖',     altNames: ['Man Sa', 'Mansa'],                   region: 'Yiwu' },
    { name: 'Yi Bang',           chineseName: '倚邦',                                                      region: 'Mengla' },
    { name: 'Ge Deng',           chineseName: '革登',                                                      region: 'Mengla' },

    // Bulang / Menghai region
    { name: 'Lao Ban Zhang',     chineseName: '老班章',                                                    region: 'Menghai' },
    { name: 'Xin Ban Zhang',     chineseName: '新班章',                                                    region: 'Menghai' },
    { name: 'Lao Man E',         chineseName: '老曼峨',                                                    region: 'Menghai' },
    { name: 'Zhang Jia Wan',     chineseName: '张家湾',                                                    region: 'Menghai' },
    { name: 'He Kai',            chineseName: '贺开',                                                      region: 'Menghai' },
    { name: 'Nan Nuo',           chineseName: '南糯',                                                      region: 'Menghai' },
    { name: 'Bada',              chineseName: '巴达',                                                      region: 'Menghai' },
    { name: 'Bu Lang',           chineseName: '布朗',     altNames: ['Bulang'],                            region: 'Menghai' },
    { name: 'Jingmai',           chineseName: '景迈',                                                      region: 'Jingmai' },
    { name: 'Man Jing',          chineseName: '曼景',                                                      region: 'Jingmai' },

    // Lincang region
    { name: 'Bing Dao',          chineseName: '冰岛',     altNames: ['Bingdao', 'Ice Island'],             region: 'Lincang' },
    { name: 'Xi Gui',            chineseName: '昔归',     altNames: ['Xige', 'Xigu'],                      region: 'Lincang' },
    { name: 'Mengku',            chineseName: '勐库',                                                      region: 'Lincang' },
    { name: 'Na Ka',             chineseName: '那卡',                                                      region: 'Lincang' },
    { name: 'Na Han',            chineseName: '那罕',                                                      region: 'Lincang' },
    { name: 'San He She',        chineseName: '三合社',                                                    region: 'Lincang' },
    { name: 'Wang Zi Shan',      chineseName: '王子山',                                                    region: 'Lincang' },
    { name: 'Lincang Wild Arbor',chineseName: '临沧野生',                                                  region: 'Lincang' },

    // Other mountains / areas
    { name: 'Jinggu',            chineseName: '景谷',                                                      region: 'Jinggu' },
    { name: 'Bao He',            chineseName: '保合',                                                      region: 'Jinggu' },
    { name: 'Nuo Song',          chineseName: '糯松',                                                      region: 'Jinggu' },
    { name: 'Wuliang',           chineseName: '无量山',                                                    region: 'Wuliang Mountain' },
    { name: 'Ailao',             chineseName: '哀牢山',                                                    region: 'Ailao Mountain' },
    { name: 'Dehong',            chineseName: '德宏',                                                      region: 'Dehong' },
    { name: 'Gaoligong',         chineseName: '高黎贡山',                                                  region: 'Dehong' },
    { name: "Pu'er",             chineseName: '普洱市',   altNames: ['Pu-er City'],                        region: "Pu'er" },

    // Factory / blended productions
    { name: 'Dayi 7542',         chineseName: '大益7542', altNames: ['Menghai 7542'],                      region: 'Menghai' },
    { name: 'Dayi 7532',         chineseName: '大益7532',                                                  region: 'Menghai' },
    { name: 'Dayi 8582',         chineseName: '大益8582', altNames: ['Menghai 8582'],                      region: 'Menghai' },
    { name: 'Xiaguan Tuo',       chineseName: '下关沱茶',                                                  region: 'Xiaguan' },
    { name: 'Xiaguan Jia Ji',    chineseName: '下关甲级沱',                                                region: 'Xiaguan' },
    { name: 'Chen Sheng Hao',    chineseName: '陈升号',                                                    region: 'Menghai' },
    { name: 'Yi Chang Hao',      chineseName: '易昌号' },
    { name: 'Hai Lang Hao',      chineseName: '海朗号' },
    { name: 'Yiwu Gu Liu',       chineseName: '易武古柳',                                                  region: 'Yiwu' },

    // Descriptive terms
    { name: 'Gushu',             chineseName: '古树',     altNames: ['Ancient Tree', 'Old Growth'] },
    { name: 'Qiao Mu',           chineseName: '乔木',     altNames: ['Wild Arbor', 'Tall Tree'] },
    { name: 'Tai Di Cha',        chineseName: '台地茶',   altNames: ['Plantation Tea'] },
    { name: 'Mao Cha',           chineseName: '毛茶',     altNames: ['Rough Tea', 'Unprocessed Puerh'] },
  ],

  // ─────────────────────────────────────────────────────────────────────────
  // SHOU PUERH (Ripe / Cooked Puerh)
  // ─────────────────────────────────────────────────────────────────────────
  Shou: [
    // Factory / region
    { name: 'Menghai Shou',      chineseName: '勐海熟普', altNames: ['Menghai Cooked Puerh'],              region: 'Menghai' },
    { name: 'Dayi Shou',         chineseName: '大益熟普',                                                  region: 'Menghai' },
    { name: 'Xiaguan Shou',      chineseName: '下关熟普',                                                  region: 'Xiaguan' },
    { name: 'CNNP Shou',         chineseName: '中茶熟普',                                                  region: 'Yunnan' },
    { name: 'Kunming Shou',      chineseName: '昆明熟普',                                                  region: 'Kunming' },
    { name: 'Yiwu Shou',         chineseName: '易武熟普',                                                  region: 'Yiwu' },
    { name: 'Lincang Shou',      chineseName: '临沧熟普',                                                  region: 'Lincang' },
    { name: 'Jingmai Shou',      chineseName: '景迈熟普',                                                  region: 'Jingmai' },

    // Grades
    { name: 'Gong Ting',         chineseName: '宫廷普洱', altNames: ['Palace Grade', 'Imperial Grade'] },
    { name: 'Te Ji',             chineseName: '特级熟普', altNames: ['Special Grade'] },
    { name: 'Yi Ji',             chineseName: '一级熟普', altNames: ['Grade 1'] },
    { name: 'Gushu Shou',        chineseName: '古树熟普', altNames: ['Ancient Tree Cooked'] },
    { name: 'Aged Shou',         chineseName: '陈年熟普', altNames: ['Old Cooked Puerh'] },

    // Forms
    { name: 'Mini Tuo',          chineseName: '小沱茶',   altNames: ['Mini Tuo Cha'] },
    { name: 'Shou Cake',         chineseName: '熟饼',     altNames: ['Cooked Cake'] },
    { name: 'Shou Brick',        chineseName: '熟砖',     altNames: ['Cooked Brick'] },
    { name: 'Lao Cha Tou',       chineseName: '老茶头',   altNames: ['Tea Nuggets', 'Cha Tou'] },

    // Named productions
    { name: 'Dayi 7572',         chineseName: '大益7572',                                                  region: 'Menghai' },
    { name: 'Menghai 8592',      chineseName: '大益8592',                                                  region: 'Menghai' },
    { name: 'Hong Yin',          chineseName: '红印',     altNames: ['Red Mark'] },
    { name: 'Lao Shu Yuan Cha',  chineseName: '老树圆茶' },
    { name: 'Chun Zui',          chineseName: '醇粹' },
  ],

  // ─────────────────────────────────────────────────────────────────────────
  // HERBAL (Tisanes, blended herbals, floral infusions)
  // ─────────────────────────────────────────────────────────────────────────
  Herbal: [
    // Flowers
    { name: 'Chrysanthemum',     chineseName: '菊花',     altNames: ['Ju Hua'],                            region: 'Tongxiang' },
    { name: 'Hang Ju',           chineseName: '杭菊',     altNames: ['Hangzhou Chrysanthemum'],            region: 'Hangzhou' },
    { name: 'Tai Ju',            chineseName: '台菊',     altNames: ['Tai Chrysanthemum'] },
    { name: 'Bo Ju',             chineseName: '亳菊',     altNames: ['Bo Chrysanthemum'],                  region: 'Bozhou' },
    { name: 'Chu Ju',            chineseName: '滁菊',     altNames: ['Chu Chrysanthemum'],                 region: 'Chuzhou' },
    { name: 'Osmanthus',         chineseName: '桂花',     altNames: ['Gui Hua'] },
    { name: 'Rose',              chineseName: '玫瑰花',   altNames: ['Mei Gui Hua'] },
    { name: 'Jasmine',           chineseName: '茉莉花',   altNames: ['Mo Li Hua'] },
    { name: 'Hibiscus',          chineseName: '洛神花',   altNames: ['Luo Shen Hua', 'Roselle'] },
    { name: 'Butterfly Pea Flower', chineseName: '蝶豆花', altNames: ['Blue Pea', 'Clitoria'] },
    { name: 'Lavender',          chineseName: '薰衣草' },
    { name: 'Chamomile',         chineseName: '洋甘菊' },
    { name: 'Elderflower' },
    { name: 'Calendula',                                   altNames: ['Marigold Flower'] },
    { name: 'Linden Flower',                               altNames: ['Tilleul'] },
    { name: 'Lotus Leaf',        chineseName: '荷叶',     altNames: ['He Ye'] },
    { name: 'Lily Bulb',         chineseName: '百合',     altNames: ['Bai He'] },
    { name: 'Jin Yin Hua',       chineseName: '金银花',   altNames: ['Honeysuckle Flower'] },

    // Herbs
    { name: 'Peppermint',        chineseName: '薄荷',     altNames: ['Bo He'] },
    { name: 'Spearmint' },
    { name: 'Lemongrass',        chineseName: '柠檬草',   altNames: ['Citronella'] },
    { name: 'Lemon Verbena',                               altNames: ['Verbena'] },
    { name: 'Lemon Balm',                                  altNames: ['Melissa'] },
    { name: 'Tulsi',                                       altNames: ['Holy Basil', 'Sacred Basil'] },
    { name: 'Echinacea' },
    { name: 'Nettle',                                      altNames: ['Stinging Nettle'] },
    { name: 'Moringa',                                     altNames: ['Drumstick Leaf', 'Malunggay'] },
    { name: 'Dandelion',         chineseName: '蒲公英',   altNames: ['Pu Gong Ying'] },
    { name: 'Mulberry Leaf',     chineseName: '桑叶',     altNames: ['Sang Ye'] },
    { name: 'Pandan',                                      altNames: ['Screwpine Leaf'] },

    // Roots & spices
    { name: 'Ginger',            chineseName: '生姜',     altNames: ['Sheng Jiang'] },
    { name: 'Turmeric',          chineseName: '姜黄',     altNames: ['Jiang Huang'] },
    { name: 'Licorice Root',     chineseName: '甘草',     altNames: ['Gan Cao'] },
    { name: 'Cinnamon',          chineseName: '肉桂',     altNames: ['Rou Gui Bark'] },
    { name: 'Ginseng',           chineseName: '人参',     altNames: ['Ren Shen'] },
    { name: 'Ashwagandha',                                 altNames: ['Indian Ginseng'] },

    // Berries & fruits
    { name: 'Goji Berry',        chineseName: '枸杞',     altNames: ['Wolfberry', 'Gou Qi Zi'] },
    { name: 'Hawthorn',          chineseName: '山楂',     altNames: ['Shan Zha'] },
    { name: 'Longan',            chineseName: '龙眼',     altNames: ['Long Yan', 'Dragon Eye'] },
    { name: 'Jujube',            chineseName: '红枣',     altNames: ['Red Date', 'Hong Zao'] },
    { name: 'Schisandra',        chineseName: '五味子',   altNames: ['Wu Wei Zi', 'Five Flavor Berry'] },
    { name: 'Luo Han Guo',       chineseName: '罗汉果',   altNames: ['Monk Fruit'] },

    // South African
    { name: 'Rooibos',                                     altNames: ['Red Bush', 'South African Red'] },
    { name: 'Honeybush',                                   altNames: ['Cyclopia'] },

    // Blended Chinese herbals
    { name: 'Ba Bao Cha',        chineseName: '八宝茶',   altNames: ['Eight Treasure Tea'] },
    { name: 'Ku Ding Cha',       chineseName: '苦丁茶',   altNames: ['Bitter Spike Tea'] },
    { name: 'Chrysanthemum Puerh', chineseName: '菊普',   altNames: ['Ju Pu'] },
  ],
};

/**
 * Returns a flat list of suggestion strings for the given tea category.
 * Includes all alt names so typing any form surfaces the suggestion.
 * Falls back to all varieties if no type given.
 */
export function getTeaVarietySuggestions(type?: Exclude<TeaType, 'Teaware'>): string[] {
  const entries = type ? (TEA_VARIETIES[type] ?? []) : Object.values(TEA_VARIETIES).flat();
  const names: string[] = [];
  for (const v of entries) {
    names.push(v.name);
    if (v.altNames) names.push(...v.altNames);
  }
  return names;
}

/**
 * Returns just the primary display names (no alt names) for the given type.
 */
export function getTeaVarietyNames(type?: Exclude<TeaType, 'Teaware'>): string[] {
  const entries = type ? (TEA_VARIETIES[type] ?? []) : Object.values(TEA_VARIETIES).flat();
  return entries.map((v) => v.name);
}

/**
 * Builds a map of all names + alt names → { type, originRegion, chineseName }
 * for the given type (or all types if omitted).
 * Used to power auto-fill when a variety is selected in the capture card.
 */
export function buildVarietyDataMap(
  type?: Exclude<TeaType, 'Teaware'>
): Record<string, { type?: string; originRegion?: string; chineseName?: string }> {
  const map: Record<string, { type?: string; originRegion?: string; chineseName?: string }> = {};
  const categories = type
    ? ([[type, TEA_VARIETIES[type]]] as [string, TeaVariety[]][])
    : (Object.entries(TEA_VARIETIES) as [string, TeaVariety[]][]);
  for (const [teaType, entries] of categories) {
    for (const v of entries) {
      const data = { type: teaType, originRegion: v.region, chineseName: v.chineseName };
      map[v.name] = data;
      for (const alt of v.altNames ?? []) {
        map[alt] = data;
      }
    }
  }
  return map;
}
