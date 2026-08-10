/**
 * Stable internal catalogue numbers retained for data continuity.
 *
 * ─── The decision, written down because it can never be taken twice ─────────
 *
 * Numbering is PER HOLDING, not global, and every number carries a two-letter
 * holding code: PL 004, RG 118, PD 005, MK 011, SY 003, NT 009.
 *
 * Per holding, because the seven holdings grow at wildly different rates. One
 * new plant under a global scheme would push every place, maker, mark, style
 * and named tea after it up by one, which is the renumbering that destroys the
 * whole device. Per holding, a new plant only ever touches plants.
 *
 * The code, because the front door's search interleaves all seven holdings in
 * one list, and a bare "4" beside a name there says nothing about which
 * sequence it belongs to. Two letters make the number a citation.
 *
 * ─── Where the order comes from ─────────────────────────────────────────────
 *
 * From the frozen ledgers below, and from nothing else. Never from a sorted or
 * filtered view, and deliberately not from the base arrays either: those are
 * generated from source CSVs and sorted by id, so a plant called "an-ji-b"
 * added tomorrow would land at position two and shift seventy-eight numbers.
 *
 * The ledgers record the order the base held on the day numbering started. A
 * record already listed keeps its number for good. A record the ledger has
 * never seen is numbered after every frozen one, in base order, so a new entry
 * appends rather than inserts. A record deleted from the base leaves its number
 * unfilled, which is what a withdrawn accession number does in any catalogue.
 *
 * Adding a record therefore needs no edit here. Re-ordering this file, or
 * removing an id from a ledger silently renumbers the internal reference, and
 * `catalogue.test.ts` fails if either happens.
 */
import { CULTIVARS, MARKS, NAMED_TEAS, PRODUCERS, REGIONS, STYLES } from '../../wisdom';

export type Holding = 'plants' | 'places' | 'makers' | 'marks' | 'styles' | 'named';

const PLANTS = [
  'anji-bai-cha asahi asatsuyu ba-xian bai-ji-guan bai-wen ban-tian-yao bei-dou ben-shan benifuki',
  'benihikari bi-luo-chun-qunti chin-hsin cui-yu da-hong-pao da-ye-zhong da-yeh-oolong fo-shou',
  'fuding-da-bai goko gui-hua-xiang hong-yu hong-yun huang-guan-yin huang-jin-gui huangshan-qunti-zhong',
  'inzatsu-131 jin-xuan ju-duo-zai kanayamidori kirari-31 komakage koshun liu-an-gua-pian long-jing-43',
  'long-jing-qunti-zhong mao-xie mei-zhan meiryoku mengding-ganlu mengku-da-ye-zhong mi-lan-xiang',
  'oku-yutaka okuhikari okumidori qi-lan qi-men-zhong qing-xin qing-xin-da-mao qing-xin-gan-zhi que-she',
  'rou-gui saemidori samidori shi-da-cha shizu-7132 shui-jin-gui shui-xian si-ji-chun sofu song-zhong',
  'taiwanese-wild-tea takachiho tie-guan-yin tie-luo-han tong-tian-xiang ujihikari wu-yi wuyi-cai-cha',
  'xing-ren-xiang ya-shi-xiang yabukita ying-xiang yiwu-da-ye-zhong yutakamidori zairai zhenghe-da-bai',
  'zhi-lan-xiang zi-juan',
].join(' ');

const PLACES = [
  'aichi-prefecture ailao-mountain alishan alishan-nantou-chiayi anhua anhui anji anji-county-zhejiang',
  'anxi anxi-county-fujian assam banzhang bao-loc bao-loc-lam-dong beipu bergamot bitaco-valle-del-cauca',
  'boseong bozhou bulang-mountain cangwu ceylon changkeng-anxi chiang-rai chiang-rai-province',
  'chiayi-county china chuzhou da-xue-shan da-yu-ling dali daping-anxi darjeeling dehong dimbula',
  'doi-mae-salong doke dong-ding dongting-east-mountain dongting-mountains-suzhou dongting-west-mountain',
  'emei-mountain enshi ethiopia fu-an-city-fujian fuding fuding-fujian fujian fukuoka-prefecture georgia',
  'guangdong guangxi guizhou hadong hangzhou hangzhou-zhejiang hsinchu hsinchu-county hualien-county',
  'huangshan huangshan-mountains hukou-township-anxi hunan huoshan india japan java jeju',
  'jian-ou-city-fujian jinggu jingmai jinzhai-county-lu-an junshan junshan-island-hunan',
  'kagoshima-prefecture kandy kenya kunlu-mountain kunming kyoto-prefecture lam-dong-province li-shan',
  'lincang lincang-prefecture-yunnan lishan-nantou lu-an lu-an-city-anhui lugu lugu-township-nantou lushan',
  'mae-salong-chiang-rai mahei meghalaya mengding-mountain-ya-an menghai mengku-township-lincang mengla',
  'miaoli-county mie-prefecture mingjian-township-nantou miyazaki-prefecture moc-chau-son-la muzha',
  'muzha-district-taipei naka nangang-district-taipei nanjing nantou nantou-county nara-prefecture nepal',
  'new-taipei-city nilgiri nishio-city-aichi nuwara-eliya pasha phoenix-mountain',
  'phoenix-mountains-chaozhou pinghe-county-fujian pinglin-district-new-taipei pingyang pu-er',
  'pu-er-city-yunnan qimen qimen-county-anhui rize saitama-prefecture shan-lin-xi-nantou',
  'shifeng-mountain-hangzhou shizuoka sichuan sikkim son-la-province sri-lanka sun-moon-lake',
  'sun-moon-lake-nantou suzhou taipei taiping taiping-county-anhui taitung taiwan taohua-feng-huangshan',
  'tongmu-village-wuyi tongxiang uji uji-city-kyoto uva valle-del-cauca vietnam wawee-chiang-rai wazuka',
  'wazuka-town-kyoto wenshan west-lake-hangzhou wudong-mountain-chaozhou wuliang-mountain wuyi',
  'wuyi-mountains-fujian wuzhou xiaguan xiapu-county-fujian xiniu-tang xinyang xishuangbanna-prefecture',
  'ya-an yame yilan-county yingde yiwu yiwu-mountain-yunnan yiwu-township-xishuangbanna',
  'yu-an-district-lu-an yuan-an yuchi-township-nantou yunnan zhao-an-county-fujian zhejiang zhenghe',
  'zhenghe-county-fujian zhengyan-area-wuyi zhushan-township-nantou',
].join(' ');

const MAKERS = [
  'china-national-tea-corporation hengfengyuan kunming-tea-factory liao-fu menghai-tea-factory qiaorui',
  'tongqinghao wuzhou-tea-factory xiaguan-tea-factory xinghai-tea-factory',
].join(' ');

const MARKINGS = [
  '7572 aaa-grade blue-seal-green-label golden-bull gong-jin gong-ting gongjian jia-ji red-seal',
  'three-cranes wan-yan yellow-label yi-ji zhen-pin zhong-cha-pai',
].join(' ');

const WAYS = [
  'bai-liang-hua-juan bamboo-tube basket-tea camphor-stored gaba-oolong kang-brick qi-zi-bing tie-bing',
  'wet-stored xiao-qing-gan',
].join(' ');

const NAMED_LEDGER = [
  'courage french-brick galaxy inspiration mercy miracle-fate new-rainbow old-rainbow orange-master-box',
  'passion tea-masters-cake true-love true-love-new universe wisdom yue-chen-yue-xiang yun-shen-chu',
].join(' ');

interface Sequence {
  /** The two letters that make a number a citation. */
  code: string;
  ledger: string;
  /** The base, in its own order. Only reached for an id the ledger has not seen. */
  live: () => string[];
}

const SEQUENCES: Record<Holding, Sequence> = {
  plants: { code: 'PL', ledger: PLANTS, live: () => CULTIVARS.map(entry => entry.id) },
  places: { code: 'RG', ledger: PLACES, live: () => REGIONS.map(entry => entry.id) },
  makers: { code: 'PD', ledger: MAKERS, live: () => PRODUCERS.map(entry => entry.id) },
  marks: { code: 'MK', ledger: MARKINGS, live: () => MARKS.map(entry => entry.id) },
  styles: { code: 'SY', ledger: WAYS, live: () => STYLES.map(entry => entry.id) },
  named: { code: 'NT', ledger: NAMED_LEDGER, live: () => NAMED_TEAS.map(entry => entry.id) },
};

/** Built once per holding, on the first entry of that holding a page renders. */
const built = new Map<Holding, Map<string, number>>();

function positionsFor(holding: Holding): Map<string, number> {
  const cached = built.get(holding);
  if (cached) return cached;

  const sequence = SEQUENCES[holding];
  const positions = new Map<string, number>();
  const frozen = sequence.ledger.split(' ').filter(Boolean);
  frozen.forEach((id, index) => positions.set(id, index + 1));

  // Anything the ledger has never seen is appended, in base order, after every
  // number the ledger already spent. A hole left by a deleted record is not
  // refilled: an accession number is retired with the record.
  let next = frozen.length + 1;
  for (const id of sequence.live()) {
    if (!positions.has(id)) positions.set(id, next++);
  }

  built.set(holding, positions);
  return positions;
}

/** Zero padded to three, which is where the reference sits and where it stays for a while. */
const pad = (value: number): string => String(value).padStart(3, '0');

/**
 * The catalogue number of one record, or null when the holding does not hold
 * it. A number is never invented for a name the base cannot place.
 */
export function catalogueNumber(holding: Holding, id: string | undefined): string | null {
  if (!id) return null;
  const position = positionsFor(holding).get(id);
  return position == null ? null : `${SEQUENCES[holding].code} ${pad(position)}`;
}

/** Which holding a reference path belongs to, so a search hit can be numbered too. */
export function holdingForPath(path: string): Holding | null {
  if (path.startsWith('/wisdom/cultivar/')) return 'plants';
  if (path.startsWith('/wisdom/region/')) return 'places';
  if (path.startsWith('/wisdom/producer/')) return 'makers';
  if (path.startsWith('/wisdom/mark/')) return 'marks';
  if (path.startsWith('/wisdom/style/')) return 'styles';
  if (path.startsWith('/wisdom/named/')) return 'named';
  return null;
}

/** The number for a record reached by its own reference path. */
export function catalogueNumberFor(path: string): string | null {
  const holding = holdingForPath(path);
  if (!holding) return null;
  return catalogueNumber(holding, path.split('/').pop());
}
