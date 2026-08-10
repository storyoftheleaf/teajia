export const WISDOM_TARGET_TYPES = [
  'article',
  'tea_profile',
  'wisdom_node',
  'product_tasting',
  'promoted_tasting_note',
] as const;

export const WISDOM_RELATIONSHIP_KINDS = ['supports', 'illustrates', 'mentions', 'is_example_of'] as const;
export const WISDOM_REVIEW_STATUSES = ['proposed', 'approved', 'rejected'] as const;
export const WISDOM_NODE_TYPES = ['cultivar', 'region', 'tea_type', 'producer', 'mark', 'style', 'named_tea'] as const;

export type WisdomTargetType = typeof WISDOM_TARGET_TYPES[number];
export type WisdomRelationshipKind = typeof WISDOM_RELATIONSHIP_KINDS[number];
export type WisdomReviewStatus = typeof WISDOM_REVIEW_STATUSES[number];
export type WisdomNodeType = typeof WISDOM_NODE_TYPES[number];

// Compact ID-only mirror of the authoritative static Wisdom corpus. Keeping
// only slugs here avoids bundling the research prose and entity metadata into
// the Worker while still letting mutations fail closed on invented nodes.
const WISDOM_NODE_IDS: Record<WisdomNodeType, ReadonlySet<string>> = {
  cultivar: new Set(`anji-bai-cha,asahi,asatsuyu,ba-xian,bai-ji-guan,bai-wen,ban-tian-yao,bei-dou,ben-shan,benifuki,benihikari,bi-luo-chun-qunti,chin-hsin,cui-yu,da-hong-pao,da-ye-zhong,da-yeh-oolong,fo-shou,fuding-da-bai,goko,gui-hua-xiang,hong-yu,hong-yun,huang-guan-yin,huang-jin-gui,huangshan-qunti-zhong,inzatsu-131,jin-xuan,ju-duo-zai,kanayamidori,kirari-31,komakage,koshun,liu-an-gua-pian,long-jing-43,long-jing-qunti-zhong,mao-xie,mei-zhan,meiryoku,mengding-ganlu,mengku-da-ye-zhong,mi-lan-xiang,oku-yutaka,okuhikari,okumidori,qi-lan,qi-men-zhong,qing-xin,qing-xin-da-mao,qing-xin-gan-zhi,que-she,rou-gui,saemidori,samidori,shi-da-cha,shizu-7132,shui-jin-gui,shui-xian,si-ji-chun,sofu,song-zhong,taiwanese-wild-tea,takachiho,tie-guan-yin,tie-luo-han,tong-tian-xiang,ujihikari,wu-yi,wuyi-cai-cha,xing-ren-xiang,ya-shi-xiang,yabukita,ying-xiang,yiwu-da-ye-zhong,yutakamidori,zairai,zhenghe-da-bai,zhi-lan-xiang,zi-juan`.split(',')),
  region: new Set(`aichi-prefecture,alishan-nantou-chiayi,anhua,anji-county-zhejiang,anxi-county-fujian,banzhang,bao-loc-lam-dong,beipu,bergamot,bitaco-valle-del-cauca,bulang-mountain,cangwu,ceylon,changkeng-anxi,chiang-rai-province,chiayi-county,china,da-xue-shan,dali,daping-anxi,darjeeling,dongting-east-mountain,dongting-mountains-suzhou,dongting-west-mountain,fu-an-city-fujian,fuding-fujian,fukuoka-prefecture,hangzhou-zhejiang,hsinchu-county,hualien-county,huangshan-mountains,hukou-township-anxi,india,japan,jian-ou-city-fujian,jinzhai-county-lu-an,junshan-island-hunan,kagoshima-prefecture,kunlu-mountain,kyoto-prefecture,lam-dong-province,lincang-prefecture-yunnan,lishan-nantou,lu-an-city-anhui,lugu-township-nantou,mae-salong-chiang-rai,mahei,mengding-mountain-ya-an,mengku-township-lincang,miaoli-county,mie-prefecture,mingjian-township-nantou,miyazaki-prefecture,moc-chau-son-la,muzha,muzha-district-taipei,naka,nangang-district-taipei,nantou-county,nara-prefecture,new-taipei-city,nishio-city-aichi,pasha,phoenix-mountains-chaozhou,pinghe-county-fujian,pinglin-district-new-taipei,pu-er-city-yunnan,qimen-county-anhui,saitama-prefecture,shan-lin-xi-nantou,shifeng-mountain-hangzhou,shizuoka,son-la-province,sun-moon-lake-nantou,taiping-county-anhui,taohua-feng-huangshan,tongmu-village-wuyi,uji,uji-city-kyoto,valle-del-cauca,wawee-chiang-rai,wazuka,wazuka-town-kyoto,west-lake-hangzhou,wudong-mountain-chaozhou,wuyi-mountains-fujian,wuzhou,xiapu-county-fujian,xiniu-tang,xishuangbanna-prefecture,yilan-county,yiwu-mountain-yunnan,yiwu-township-xishuangbanna,yu-an-district-lu-an,yuchi-township-nantou,zhao-an-county-fujian,zhenghe-county-fujian,zhengyan-area-wuyi,zhushan-township-nantou,ailao-mountain,anhui,anji,anxi,bozhou,chuzhou,dehong,emei-mountain,enshi,fuding,fujian,guangdong,guangxi,guizhou,hangzhou,huangshan,hunan,huoshan,jinggu,jingmai,junshan,kunming,lincang,lu-an,lushan,menghai,mengla,nanjing,phoenix-mountain,pingyang,pu-er,qimen,sichuan,suzhou,taiping,tongxiang,wuliang-mountain,wuyi,xiaguan,xinyang,ya-an,yingde,yiwu,yuan-an,yunnan,zhejiang,zhenghe,alishan,da-yu-ling,hsinchu,li-shan,lugu,nantou,dong-ding,sun-moon-lake,taipei,taitung,taiwan,wenshan,yame,boseong,hadong,jeju,assam,doke,meghalaya,nilgiri,sikkim,nepal,dimbula,kandy,nuwara-eliya,sri-lanka,uva,bao-loc,vietnam,chiang-rai,doi-mae-salong,java,ethiopia,georgia,kenya,rize`.split(',')),
  tea_type: new Set('green,white,yellow,oolong,red,dark,sheng,shou,herbal'.split(',')),
  producer: new Set('china-national-tea-corporation,hengfengyuan,kunming-tea-factory,liao-fu,menghai-tea-factory,qiaorui,tongqinghao,wuzhou-tea-factory,xiaguan-tea-factory,xinghai-tea-factory'.split(',')),
  mark: new Set('7572,aaa-grade,blue-seal-green-label,golden-bull,gong-jin,gong-ting,gongjian,jia-ji,red-seal,three-cranes,wan-yan,yellow-label,yi-ji,zhen-pin,zhong-cha-pai'.split(',')),
  style: new Set('bai-liang-hua-juan,bamboo-tube,basket-tea,camphor-stored,gaba-oolong,kang-brick,qi-zi-bing,tie-bing,wet-stored,xiao-qing-gan'.split(',')),
  named_tea: new Set('courage,french-brick,galaxy,inspiration,mercy,miracle-fate,new-rainbow,old-rainbow,orange-master-box,passion,tea-masters-cake,true-love,true-love-new,universe,wisdom,yue-chen-yue-xiang,yun-shen-chu'.split(',')),
};

const LEGAL_RELATIONSHIPS: Record<WisdomTargetType, ReadonlySet<WisdomRelationshipKind>> = {
  article: new Set(['supports', 'mentions']),
  tea_profile: new Set(['illustrates', 'mentions', 'is_example_of']),
  wisdom_node: new Set(WISDOM_RELATIONSHIP_KINDS),
  product_tasting: new Set(['supports', 'illustrates']),
  promoted_tasting_note: new Set(['supports', 'illustrates']),
};

export function wisdomNodeExists(nodeType: string, nodeId: string): boolean {
  if (!WISDOM_NODE_TYPES.includes(nodeType as WisdomNodeType)) return false;
  return WISDOM_NODE_IDS[nodeType as WisdomNodeType].has(nodeId);
}

export function wisdomManifestNodes() {
  return WISDOM_NODE_TYPES.flatMap(nodeType => [...WISDOM_NODE_IDS[nodeType]].map(node_id => ({
    node_type: nodeType,
    node_id,
    expects_writing: true,
  })));
}

export interface WisdomRelationInput {
  node_type: string;
  node_id: string;
  target_type: string;
  target_id: string;
  target_subtype?: string | null;
  relationship_kind: string;
  review_status: string;
}

export function nodeKey(nodeType: string, nodeId: string): string {
  return `${nodeType}:${nodeId}`;
}

export function validateWisdomRelationInput(input: WisdomRelationInput): { ok: true } | { ok: false; code: string } {
  if (!input.node_type.trim() || !input.node_id.trim() || !input.target_id.trim()) {
    return { ok: false, code: 'required_field_missing' };
  }
  if (!WISDOM_NODE_TYPES.includes(input.node_type as typeof WISDOM_NODE_TYPES[number])) {
    return { ok: false, code: 'invalid_node_type' };
  }
  if (!wisdomNodeExists(input.node_type, input.node_id)) {
    return { ok: false, code: 'source_node_not_found' };
  }
  if (!WISDOM_TARGET_TYPES.includes(input.target_type as WisdomTargetType)) {
    return { ok: false, code: 'invalid_target_type' };
  }
  if (!WISDOM_RELATIONSHIP_KINDS.includes(input.relationship_kind as WisdomRelationshipKind)) {
    return { ok: false, code: 'invalid_relationship_kind' };
  }
  if (!WISDOM_REVIEW_STATUSES.includes(input.review_status as WisdomReviewStatus)) {
    return { ok: false, code: 'invalid_review_status' };
  }
  if (input.target_type === 'wisdom_node' && !input.target_subtype?.trim()) {
    return { ok: false, code: 'target_subtype_required' };
  }
  if (input.target_type === 'wisdom_node' && !WISDOM_NODE_TYPES.includes(input.target_subtype as typeof WISDOM_NODE_TYPES[number])) {
    return { ok: false, code: 'invalid_target_subtype' };
  }
  if (input.target_type === 'wisdom_node' && !wisdomNodeExists(input.target_subtype!, input.target_id)) {
    return { ok: false, code: 'target_node_not_found' };
  }
  if (input.target_type !== 'wisdom_node' && input.target_subtype?.trim()) {
    return { ok: false, code: 'target_subtype_not_allowed' };
  }
  if (!LEGAL_RELATIONSHIPS[input.target_type as WisdomTargetType].has(input.relationship_kind as WisdomRelationshipKind)) {
    return { ok: false, code: 'illegal_relationship_kind' };
  }
  return { ok: true };
}

export type WisdomFindingKind = 'missing_writing' | 'missing_target' | 'unpublished_dependency' | 'orphaned_article';

export interface WisdomFinding {
  kind: WisdomFindingKind;
  node_type?: string;
  node_id?: string;
  target_type?: string;
  target_subtype?: string | null;
  target_id: string;
}

interface FindingInput {
  nodes: Array<{ node_type: string; node_id: string; expects_writing?: boolean }>;
  relations: Array<{
    node_type: string;
    node_id: string;
    target_type: string;
    target_id: string;
    target_subtype?: string | null;
    review_status: string;
  }>;
  targets: Array<{ id: string; target_type: string; target_subtype?: string | null; is_public?: boolean }>;
  articles: Array<{ id: string; status: string }>;
}

function wisdomTargetKey(targetType: string, targetId: string, targetSubtype?: string | null): string {
  return targetType === 'wisdom_node'
    ? `${targetType}:${targetSubtype || ''}:${targetId}`
    : `${targetType}:${targetId}`;
}

export function deriveWisdomFindings(input: FindingInput): WisdomFinding[] {
  const findings: WisdomFinding[] = [];
  const targetKeys = new Map(input.targets.map(target => [
    wisdomTargetKey(target.target_type, target.id, target.target_subtype), target,
  ]));
  const approved = input.relations.filter(relation => relation.review_status === 'approved');

  for (const node of input.nodes) {
    const nodeRelations = approved.filter(relation => relation.node_type === node.node_type && relation.node_id === node.node_id);
    const publicWriting = nodeRelations.some(relation => {
      if (relation.target_type !== 'article') return false;
      const target = targetKeys.get(wisdomTargetKey('article', relation.target_id));
      return Boolean(target && target.is_public !== false);
    });
    if (node.expects_writing && !publicWriting) {
      findings.push({ kind: 'missing_writing', node_type: node.node_type, node_id: node.node_id, target_id: node.node_id });
    }
  }

  for (const relation of approved) {
    const target = targetKeys.get(wisdomTargetKey(relation.target_type, relation.target_id, relation.target_subtype));
    if (!target) {
      findings.push({
        kind: 'missing_target',
        node_type: relation.node_type,
        node_id: relation.node_id,
        target_type: relation.target_type,
        target_subtype: relation.target_subtype,
        target_id: relation.target_id,
      });
    } else if (target.is_public === false) {
      findings.push({
        kind: 'unpublished_dependency',
        node_type: relation.node_type,
        node_id: relation.node_id,
        target_type: relation.target_type,
        target_subtype: relation.target_subtype,
        target_id: relation.target_id,
      });
    }
  }

  const relatedArticleIds = new Set(approved.filter(relation => relation.target_type === 'article').map(relation => relation.target_id));
  for (const article of input.articles) {
    if (article.status === 'published' && !relatedArticleIds.has(article.id)) {
      findings.push({ kind: 'orphaned_article', target_type: 'article', target_id: article.id });
    }
  }
  return findings;
}
