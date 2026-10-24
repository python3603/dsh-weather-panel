/**
 * 预警详情用的「要点」文本。
 *
 * 为什么内置而不是抓官网：预警详情页 `publish/alarm/<id>.html` 是服务端渲染的
 * HTML，**不带 CORS 头**；DSH 的 `ctx.remote` 能力集合又是在构建期固定装配的，
 * 第三方插件不能在运行时给 Host 加一个取网页的服务。所以详情面板展示的是
 * 「结构化摘要 + 该类型的通用防范要点」，并在最后给出官方原文链接——比伪造
 * 当地原文更安全，也不会因为上游改版而失效。
 *
 * 文案刻意保持通用：不写具体风力/雨量阈值，也不复述某个城市的具体预报。
 */

export const ALERT_GUIDE_FALLBACK = {
  zh: {
    summary: '该地区已发布气象预警，风险高于常态，请留意当地气象部门的最新通报。',
    bullets: [
      '关注当地气象台发布的最新预警与滚动预报',
      '减少不必要的户外活动，随身携带雨具',
      '检查门窗、排水口和户外易坠落物品'
    ]
  },
  en: {
    summary: 'A weather warning is in force for this area; conditions are riskier than usual.',
    bullets: [
      'Follow the latest warnings and nowcasts from the local weather service',
      'Cut back on unnecessary outdoor activity',
      'Check doors, drains and loose outdoor objects'
    ]
  }
};

export const ALERT_GUIDES = {
  台风: {
    zh: {
      summary: '受台风或其外围环流影响，风力明显增强，并可能伴随强降雨和海面大浪。',
      bullets: [
        '停止露天活动和高空、水上等户外危险作业',
        '加固门窗、广告牌、临时搭建物，收回阳台物品',
        '船舶回港避风，渔业与海上作业人员上岸',
        '远离海边、河口和低洼易涝区域'
      ]
    },
    en: {
      summary: 'A typhoon or its outer bands are strengthening winds, with heavy rain and rough seas possible.',
      bullets: [
        'Stop outdoor work at height and on the water',
        'Secure doors, windows, signs and temporary structures',
        'Bring boats back to harbour and crews ashore',
        'Stay away from the coast, river mouths and flood-prone low ground'
      ]
    }
  },
  暴雨: {
    zh: {
      summary: '短时降雨强度大，城市内涝、山洪和地质灾害风险上升。',
      bullets: [
        '低洼地区、地下空间人员及时转移',
        '切断有危险的室外电源，不在积水中行走或驾车',
        '学校、工地等视情况停课停工',
        '检查排水设施，防范山洪与滑坡'
      ]
    },
    en: {
      summary: 'Intense rainfall raises the risk of urban flooding, flash floods and landslides.',
      bullets: [
        'Move people out of low ground and basements early',
        'Cut hazardous outdoor power; do not walk or drive through floodwater',
        'Suspend school and site work where needed',
        'Clear drains and watch for flash floods and slides'
      ]
    }
  },
  暴雪: {
    zh: {
      summary: '降雪量大，道路积雪结冰，交通与设施农业受影响。',
      bullets: [
        '减少驾车出行，必须出行时减速慢行',
        '及时清扫积雪，加固大棚和临时建筑',
        '注意防寒保暖，防范一氧化碳中毒',
        '关注航班、铁路与高速的管制信息'
      ]
    },
    en: {
      summary: 'Heavy snowfall will cover roads and burden transport and greenhouses.',
      bullets: [
        'Keep driving to a minimum; slow down if you must go out',
        'Clear snow promptly and brace greenhouses and sheds',
        'Dress warmly and avoid indoor carbon-monoxide risk',
        'Check flight, rail and motorway closures'
      ]
    }
  },
  寒潮: {
    zh: {
      summary: '气温骤降并伴大风，易出现霜冻和道路结冰。',
      bullets: [
        '及时添衣，关注老人、儿童和户外作业人员',
        '做好水管、农作物和牲畜防冻',
        '固定户外设施，防范大风影响',
        '注意取暖安全，保持通风'
      ]
    },
    en: {
      summary: 'A sharp temperature drop with strong winds may bring frost and icy roads.',
      bullets: [
        'Dress for the cold; check on older people, children and outdoor workers',
        'Protect pipes, crops and livestock from freezing',
        'Secure outdoor fittings against the wind',
        'Heat safely and keep rooms ventilated'
      ]
    }
  },
  大风: {
    zh: {
      summary: '风力明显增大，高空坠物、临时建筑受损和火灾风险上升。',
      bullets: [
        '停止高空、水上和露天危险作业',
        '远离广告牌、临时搭建物和树木',
        '加固门窗、棚架与户外物品',
        '注意森林、草原和城市防火'
      ]
    },
    en: {
      summary: 'Strong winds raise the risk of falling objects, damaged structures and fire spread.',
      bullets: [
        'Stop work at height, on water and in the open',
        'Stay away from signs, temporary structures and trees',
        'Secure doors, windows, frames and loose objects',
        'Watch fire risk in forests and grassland'
      ]
    }
  },
  海上大风: {
    zh: {
      summary: '海面风力显著增强，航行与海上作业风险高。',
      bullets: [
        '船舶回港避风或绕行避风海域',
        '加固港口设施，防止走锚、搁浅和碰撞',
        '海上作业人员撤离，暂停海上观光与垂钓',
        '关注海事部门发布的航行警告'
      ]
    },
    en: {
      summary: 'Winds over the sea are strengthening sharply; sailing and offshore work are hazardous.',
      bullets: [
        'Bring vessels back or route them around the strong wind area',
        'Secure port facilities against dragging and collisions',
        'Recall offshore crews; pause sea trips and fishing',
        'Follow maritime navigation warnings'
      ]
    }
  },
  海浪: {
    zh: {
      summary: '近岸浪高明显增大，沿岸与海上活动风险上升。',
      bullets: [
        '远离海边栈道、礁石和堤坝',
        '暂停海上观光、潜水和垂钓',
        '船舶避开大浪区，及时回港',
        '关注海洋部门发布的浪高预报'
      ]
    },
    en: {
      summary: 'Wave heights are rising near the coast, making shore and sea activity risky.',
      bullets: [
        'Keep off coastal paths, rocks and sea walls',
        'Pause sea trips, diving and fishing',
        'Keep vessels clear of high seas and back in harbour',
        'Follow official wave forecasts'
      ]
    }
  },
  风暴潮: {
    zh: {
      summary: '天文潮与风暴增水叠加，低洼岸段可能被淹。',
      bullets: [
        '沿海低洼区域人员提前转移',
        '关闭滨海景区与涉海设施，加固海堤闸口',
        '船舶回港，避免在码头长时间停靠',
        '关注海洋部门增水预报与潮位'
      ]
    },
    en: {
      summary: 'Storm surge on top of tides may flood low-lying coastal areas.',
      bullets: [
        'Move people out of low coastal ground early',
        'Close seafront sites and secure sea walls and gates',
        'Bring boats in and avoid long stays alongside',
        'Follow surge and tide forecasts'
      ]
    }
  },
  沙尘暴: {
    zh: {
      summary: '能见度下降、空气质量变差，呼吸道与交通受影响。',
      bullets: [
        '关好门窗，外出戴口罩和防风镜',
        '减少户外运动，敏感人群留在室内',
        '驾车减速慢行并开启雾灯',
        '加固棚架、覆盖易被吹散的物料'
      ]
    },
    en: {
      summary: 'Dust cuts visibility and air quality, affecting breathing and traffic.',
      bullets: [
        'Close windows; wear a mask and eye protection outside',
        'Limit outdoor exercise; sensitive groups stay indoors',
        'Drive slowly with fog lights on',
        'Secure frames and cover loose material'
      ]
    }
  },
  高温: {
    zh: {
      summary: '持续高温，中暑与用电负荷风险上升。',
      bullets: [
        '避开午后高温时段户外活动',
        '及时补水，注意防暑降温',
        '关注老人、儿童和户外作业人员',
        '注意用电安全，防范火灾'
      ]
    },
    en: {
      summary: 'Sustained heat raises heat-illness and power-load risk.',
      bullets: [
        'Avoid outdoor activity during the hottest hours',
        'Drink water and keep cool',
        'Check on older people, children and outdoor workers',
        'Use electricity safely and guard against fire'
      ]
    }
  },
  干旱: {
    zh: {
      summary: '降水持续偏少，农业与供水压力增大。',
      bullets: [
        '节约用水，优先保障生活用水',
        '农业采取节水灌溉与保墒措施',
        '注意森林草原防火，严禁野外用火',
        '关注气象部门的人工增雨作业信息'
      ]
    },
    en: {
      summary: 'Persistent dry weather is straining water supply and farming.',
      bullets: [
        'Save water and prioritise household supply',
        'Use water-saving irrigation and conserve soil moisture',
        'Guard against wildfire; no open burning',
        'Follow rain-enhancement announcements'
      ]
    }
  },
  雷电: {
    zh: {
      summary: '雷暴活跃，户外人员与电子设备易受雷击。',
      bullets: [
        '尽快进入有防雷设施的建筑物',
        '远离大树、电杆、铁塔和水面',
        '停止游泳、垂钓和高空作业',
        '拔掉不必要的电源与天线插头'
      ]
    },
    en: {
      summary: 'Thunderstorms are active; people outdoors and electronics are exposed.',
      bullets: [
        'Get into a building with lightning protection',
        'Stay clear of trees, poles, towers and water',
        'Stop swimming, fishing and work at height',
        'Unplug unnecessary power and antenna leads'
      ]
    }
  },
  雷雨大风: {
    zh: {
      summary: '雷暴伴随短时大风，易有树木倒伏与临时建筑受损。',
      bullets: [
        '进入坚固建筑内躲避，远离门窗',
        '固定临时搭建物与户外物品',
        '暂停高空和水上作业',
        '注意短时强降雨造成的积水'
      ]
    },
    en: {
      summary: 'Thunderstorms bring brief strong winds that can fell trees and damage structures.',
      bullets: [
        'Shelter in a solid building, away from windows',
        'Secure temporary structures and loose objects',
        'Pause work at height and on water',
        'Watch for ponding from brief heavy rain'
      ]
    }
  },
  冰雹: {
    zh: {
      summary: '强对流可能降雹，农作物、车辆和户外人员易受损。',
      bullets: [
        '人员和牲畜进入坚固建筑物躲避',
        '车辆停入车库或有遮挡处',
        '农业覆盖防护网或采取防雹措施',
        '注意伴随的雷暴大风'
      ]
    },
    en: {
      summary: 'Convection may produce hail that damages crops, vehicles and people outdoors.',
      bullets: [
        'Shelter people and livestock in solid buildings',
        'Park vehicles under cover',
        'Cover crops with nets or hail guards',
        'Watch the accompanying thunderstorm winds'
      ]
    }
  },
  霜冻: {
    zh: {
      summary: '夜间地表温度低，作物与水管易受冻害。',
      bullets: [
        '对蔬菜、果树和幼苗采取覆盖保温',
        '做好水管、水表防冻',
        '关注次日清晨的最低气温',
        '大棚加强夜间保温'
      ]
    },
    en: {
      summary: 'Overnight ground frost can damage crops and freeze pipes.',
      bullets: [
        'Cover vegetables, fruit trees and seedlings',
        'Insulate pipes and meters',
        'Watch the pre-dawn minimum temperature',
        'Keep greenhouses warm overnight'
      ]
    }
  },
  大雾: {
    zh: {
      summary: '能见度显著下降，交通与户外作业受影响。',
      bullets: [
        '驾车减速慢行，开启雾灯并加大车距',
        '减少户外活动，敏感人群注意防护',
        '关注高速、机场与港口的管制信息',
        '水上交通注意瞭望与减速'
      ]
    },
    en: {
      summary: 'Visibility drops sharply, affecting traffic and outdoor work.',
      bullets: [
        'Drive slowly with fog lights and a longer gap',
        'Limit outdoor activity; sensitive groups take care',
        'Check motorway, airport and port closures',
        'Slow down and keep a lookout on the water'
      ]
    }
  },
  霾: {
    zh: {
      summary: '空气质量转差，能见度下降，呼吸道不适风险上升。',
      bullets: [
        '减少户外运动，外出佩戴口罩',
        '儿童、老人和呼吸道疾病人群尽量留在室内',
        '驾车开启雾灯、注意车距',
        '室内可适度使用空气净化设备'
      ]
    },
    en: {
      summary: 'Air quality worsens and visibility drops; breathing discomfort rises.',
      bullets: [
        'Limit outdoor exercise and wear a mask outside',
        'Children, older people and those with lung conditions stay in',
        'Use fog lights and keep distance when driving',
        'Consider an air purifier indoors'
      ]
    }
  },
  道路结冰: {
    zh: {
      summary: '路面结冰，车辆制动距离变长，行人易滑倒。',
      bullets: [
        '非必要不驾车，出行减速慢行、避免急刹',
        '行人穿防滑鞋，注意台阶与桥面',
        '相关部门及时撒盐除冰',
        '关注高速与山区道路的封闭信息'
      ]
    },
    en: {
      summary: 'Ice on roads lengthens stopping distances and makes walking hazardous.',
      bullets: [
        'Avoid driving unless necessary; slow down and brake early',
        'Wear non-slip shoes; watch steps and bridges',
        'Authorities should salt and clear ice promptly',
        'Check motorway and mountain-road closures'
      ]
    }
  },
  森林火险: {
    zh: {
      summary: '植被干燥、火险等级高，野外用火极易引发火灾。',
      bullets: [
        '严禁野外用火与携带火种进山',
        '加强林区巡查与火源管控',
        '清理可燃物，检查防火隔离带',
        '发现火情立即报警并撤离'
      ]
    },
    en: {
      summary: 'Dry vegetation means high fire danger; open flames can start fires easily.',
      bullets: [
        'No open fire or open-flame items in forest areas',
        'Increase patrols and control ignition sources',
        'Clear fuel and check firebreaks',
        'Report any fire immediately and evacuate'
      ]
    }
  },
  强对流: {
    zh: {
      summary: '雷暴、大风、短时强降雨或冰雹可能同时出现，破坏力强。',
      bullets: [
        '关注短时临近预报，提前调整出行',
        '进入坚固建筑，远离临时搭建物',
        '暂停高空、水上和露天作业',
        '防范积水、树木倒伏与停电'
      ]
    },
    en: {
      summary: 'Thunderstorms, strong winds, downpours or hail may arrive together.',
      bullets: [
        'Follow nowcasts and adjust travel early',
        'Shelter in a solid building, clear of temporary structures',
        'Pause work at height, on water and in the open',
        'Watch for ponding, fallen trees and outages'
      ]
    }
  },
  低温: {
    zh: {
      summary: '气温持续偏低，供暖、农业与户外作业受影响。',
      bullets: [
        '加强保暖，注意老人与慢性病人群',
        '做好管道、农作物与牲畜防冻',
        '取暖时保持通风，防范一氧化碳中毒',
        '户外作业缩短时长、做好防护'
      ]
    },
    en: {
      summary: 'Sustained low temperatures affect heating, farming and outdoor work.',
      bullets: [
        'Keep warm; watch older people and those with chronic illness',
        'Protect pipes, crops and livestock',
        'Ventilate when heating to avoid carbon monoxide',
        'Shorten outdoor shifts and dress for it'
      ]
    }
  },
  地质灾害: {
    zh: {
      summary: '强降雨后坡体不稳，滑坡、崩塌风险上升。',
      bullets: [
        '远离陡坡、沟谷和切坡建房区域',
        '发现裂缝、渗水或异响立即撤离',
        '听从当地转移安排，勿擅自返回',
        '山区出行避开雨后时段'
      ]
    },
    en: {
      summary: 'After heavy rain, slopes are unstable and landslides are more likely.',
      bullets: [
        'Stay clear of steep slopes, gullies and cut-slope homes',
        'Evacuate if you see cracks, seepage or unusual noise',
        'Follow local evacuation orders; do not return early',
        'Avoid mountain travel right after rain'
      ]
    }
  },
  渍涝: {
    zh: {
      summary: '农田与低洼地段积水，作物根系受淹。',
      bullets: [
        '及时清沟排水，抢排田间积水',
        '低洼住户转移物资，切断危险电源',
        '加固田埂与围堰，防止漫溢',
        '注意涉水安全与疫病防控'
      ]
    },
    en: {
      summary: 'Waterlogging in fields and low ground can drown crop roots.',
      bullets: [
        'Clear ditches and pump water off the fields',
        'Move belongings in low homes and cut hazardous power',
        'Brace embankments against overtopping',
        'Take care in floodwater and guard against disease'
      ]
    }
  }
};

/** Guide for one alert type, falling back to generic advice. */
export function alertGuide(type) {
  const key = String(type || '').trim();
  return ALERT_GUIDES[key] || ALERT_GUIDE_FALLBACK;
}
