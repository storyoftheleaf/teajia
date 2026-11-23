import type { InventoryItem } from '../types';

interface ClayReference {
  labels: string[];
  text: string;
  source: { name: string; href: string };
}

const zishaProfile = {
  name: 'Yixing zisha materials',
  href: 'https://english.cnipa.gov.cn/attach/0/efd85b77f51c4d519815d83725367c38.pdf',
};
const wuxiMaterials = {
  name: 'Wuxi Museum on Yixing materials',
  href: 'https://www.wxmuseum.cn/Wap/News/Details/75804c85-11f2-4dc6-b873-ca8258dec33d',
};

const yixingFamily: ClayReference = { labels: ['Yixing clay', 'Yixing zisha', '宜兴紫砂', '宜興紫砂'],
    text: 'Yixing is a clay-working region in Jiangsu. Its zisha potters work with several materials, including zini (purple clay), hongni (red clay) and Benshan lüni (green clay).',
    source: zishaProfile };

const regionalReferences: ClayReference[] = [
  yixingFamily,
  { labels: ['Jianshui purple clay', 'Jianshui purple pottery', '建水紫陶'],
    text: 'In Wanyao village in Yunnan, the purple color of the local clay gave Jianshui pottery its name, zitao. Potters carve the damp body, fill the cuts with clay, and polish the fired surface without a glaze.',
    source: { name: 'Jianshui pottery in the national heritage register', href: 'https://www.ihchina.cn/project_details/14458/' } },
  { labels: ['Chaozhou clay'],
    text: 'In Fengxi, a pottery district of Chaozhou in Guangdong, potters prepare a local iron-rich red clay and pull it into shape on a turning wheel. Their small gongfu teapots are one expression of the region’s clay craft.',
    source: { name: 'Fengxi pottery in the national heritage register', href: 'https://www.ihchina.cn/art/detail/id/14467.html' } },
];

// The public vocabulary uses the same six terms as the owner guide. Only an
// explicit Yixing context can connect a pot to these regional meanings.
const yixingReferences: ClayReference[] = [
  { labels: ['Zini', 'Zi Ni', '紫泥', 'Zini · purple clay'],
    text: 'Zini is Yixing’s purple-clay family. Wuxi Museum describes a deposit at Huanglongshan in Dingshu where it lies beneath yellow rock.',
    source: wuxiMaterials },
  { labels: ['Hongni', 'Hong Ni', '红泥', '紅泥', 'Hongni · red clay'],
    text: 'Hongni is the red-clay family in the Yixing zisha tradition. Wuxi Museum describes a deposit where the raw material is hard as stone before it is prepared for forming.',
    source: wuxiMaterials },
  { labels: ['Benshan lüni', 'Ben Shan Lü Ni', '本山绿泥', '本山綠泥', 'Benshan lüni · green clay'],
    text: 'Benshan lüni is one of the principal materials used in Yixing zisha ware. Wuxi Museum describes the green clay occurring in layers between other clays.',
    source: wuxiMaterials },
  { labels: ['Zhuni', 'Zhu Ni', '朱泥', 'Zhuni · vermilion clay'],
    text: 'Zhuni is a vermilion clay used by Yixing potters. Wuxi Museum identifies it in a pear-shaped pot by Gu Jingzhou, whose smooth, undecorated body leaves the fine clay surface visible.',
    source: { name: 'Gu Jingzhou’s pear-shaped pot at Wuxi Museum', href: 'https://www.wxmuseum.cn/News/Details/f2979388-81d3-420b-b5af-df4b6f58f1f2' } },
  { labels: ['Duanni', 'Duan Ni', '段泥'],
    text: 'Duanni is a clay name used in Yixing. Wuxi Museum records duanni alongside purple and Benshan green clay in its account of the local clay layers.',
    source: wuxiMaterials },
  { labels: ['Dicaoqing', 'Di Cao Qing', '底槽清'],
    text: 'Dicaoqing is a named Yixing zisha material. A published study compared its fired microstructure with porcelain and other pottery using samples of known composition.',
    source: { name: 'Ceramics International study of Dicaoqing', href: 'https://doi.org/10.1016/j.ceramint.2020.12.178' } },
];
const normalized = (value: string) => value.trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/\s+/g, ' ');
function match(references: ClayReference[], label: string) {
  return references.find(ref => ref.labels.some(alias => normalized(alias) === label));
}

export function stockClayReading(item: Pick<InventoryItem, 'material' | 'teawareDetails'>) {
  const material = normalized(item.material || '');
  const recorded = item.teawareDetails?.clay_type?.trim();
  const specific = recorded && !/^(?:unknown|n\/a|not recorded)$/i.test(recorded) ? recorded : '';
  const label = specific || item.material?.trim() || '';
  const key = normalized(label);
  const isYixing = item.teawareDetails?.is_yixing !== false && (
    item.teawareDetails?.is_yixing === true || yixingFamily.labels.some(alias => normalized(alias) === material) || key.startsWith('yixing ')
  );
  const family = match(regionalReferences, key);
  if (family === yixingFamily && item.teawareDetails?.is_yixing === false) return undefined;
  const reference = family
    ?? (isYixing ? match(yixingReferences, key.replace(/^yixing\s+/, '')) : undefined);
  const history = item.teawareDetails?.clay_history?.trim();
  const identification = 'Teajia lists the clay as ' + label + '.';
  if (history && !/^(?:unknown|n\/a|not recorded)$/i.test(history) && (specific || reference)) {
    return { label: 'Clay', paragraphs: [identification, history] };
  }
  if (reference) return { label: 'Clay', paragraphs: [identification + ' ' + reference.text], links: [reference.source] };
  return undefined;
}
