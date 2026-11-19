'use strict';
// Display hierarchy and one collision budget for every atlas label.
const MapDetails = {
  // These snapshots live only inside one synchronous draw pass. Simulation,
  // streaming adoption and UI forecasts run outside that scope.
  frameObjects: null,
  frameOpacity: null,
  framePoints: null,
  frameSpines: null,
  frameModels: null,
  frameMatches: null,
  frameScreen: null,
  frameMemo: null,
  frameSpan: NaN,
  frameWidth: NaN,
  objectIndex: null,
  objectSource: [],
  objectsIndex() {
    const source = this.objectSource, count = OBJECTS.length;
    let same = this.objectIndex !== null && source.length === count;
    for (let i = 0; same && i < count; i++) same = source[i] === OBJECTS[i];
    if (!same) {
      const index = new Map();
      for (const o of OBJECTS) if (!index.has(o.id)) index.set(o.id, o);
      this.objectIndex = index;
      this.objectSource = OBJECTS.slice();
    }
    return this.objectIndex;
  },
  beginFrame() {
    this.frameObjects = this.objectsIndex();
    this.frameOpacity = new WeakMap();
    this.framePoints = new WeakMap();
    this.frameSpines = new WeakMap();
    this.frameModels = new WeakMap();
    this.frameMatches = new WeakMap();
    this.frameScreen = new WeakMap();
    this.frameMemo = new Map();
    this.frameSpan = cam.span;
    this.frameWidth = width;
  },
  endFrame() {
    this.frameObjects = this.frameOpacity = this.framePoints = this.frameSpines = this.frameModels =
      this.frameMatches = this.frameScreen = this.frameMemo = null;
    this.frameSpan = this.frameWidth = NaN;
  },
  massCache: new WeakMap(),
  nameCache: new WeakMap(),
  typeName(o) {
    if(o.catalogIdentityLabel)return o.catalogIdentityLabel;
    if (o.kind === 'blackhole' && (o.blackHolePopulation || o.population) === 'supermassive')
      return o.confirmed === false
        ? 'Кандидат в сверхмассивные чёрные дыры'
        : 'Сверхмассивная чёрная дыра';
    if (o.cosmicEpoch || o.distantCatalog || o.blackHoleCatalog) return o.type;
    if (o.catalogClass === 'galaxy-cluster') return 'Скопление галактик';
    if (o.cosmicSubtype === 'filament') return 'Галактический филамент';
    if (o.cosmicSubtype === 'supercluster') return 'Сверхскопление галактик';
    if (o.synthetic) return 'Искусственный игровой объект · звезда';
    const code = o.catalogType || String(o.type || '').split(' · ')[1];
    const subtype = {
      OCl: 'Рассеянное звёздное скопление',
      GCl: 'Шаровое звёздное скопление',
      '*Ass': 'Звёздная ассоциация',
      'Cl+N': 'Звёздное скопление с туманностью',
      PN: 'Планетарная туманность',
      EmN: 'Эмиссионная туманность',
      RfN: 'Отражательная туманность',
      SNR: 'Остаток сверхновой',
      HII: 'Область ионизированного водорода · туманность',
      GGroup: 'Группа галактик',
      GPair: 'Пара галактик',
      GTrpl: 'Тройка галактик',
      Dup: 'Дублирующая каталожная запись',
      NonEx: 'Историческая неподтверждённая запись',
    }[code];
    if (subtype) return subtype;
    if (o.kind === 'cluster')
      return /галактик/i.test([o.type, o.facts?.class, o.name].join(' '))
        ? 'Скопление галактик'
        : 'Звёздное скопление';
    return (
      {
        home: 'Звезда · Солнце',
        star: 'Звезда',
        pulsar: 'Пульсар · нейтронная звезда',
        blackhole: 'Чёрная дыра',
        quasar: 'Квазар · активное ядро галактики',
        galaxy: 'Галактика',
        nebula: 'Туманность',
        structure: 'Мегаструктура',
        wall: 'Галактическая стена · мегаструктура',
        void: 'Космический войд',
        ring: 'Кольцевая мегаструктура · кандидат',
        arc: 'Дуговая мегаструктура · кандидат',
        horizon: 'Космологический горизонт',
      }[o.kind] ||
      o.type ||
      'Тип не определён'
    );
  },
  starColours: {
    O: ['голубой', 'голубая'],
    B: ['бело-голубой', 'бело-голубая'],
    A: ['белый', 'белая'],
    F: ['жёлто-белый', 'жёлто-белая'],
    G: ['жёлтый', 'жёлтая'],
    K: ['оранжевый', 'оранжевая'],
    M: ['красный', 'красная'],
  },
  starType(text) {
    const s = String(text || '')
      .split(/\s*\+\s*(?=\S)/)[0]
      .replace(/^[^A-Za-z]+/, '')
      .trim();
    if (!s) return '';
    if (/^(?:D[ABCOQXZ]?(?![a-z])|WD)/.test(s)) return 'белый карлик';
    if (/^W[NCOR]?(?![a-zD])/.test(s)) return 'звезда Вольфа — Райе';
    if (/^(?:C(?![a-z])|[RN]\d)/.test(s)) return 'углеродная звезда';
    if (/^[LTY]\d/.test(s)) return 'коричневый карлик';
    const m = /^(sd|sg|esd|usd|d|g|c|k)?([OBAFGKM])(.*)$/.exec(s);
    if (!m) return '';
    const [masculine, feminine] = this.starColours[m[2]],
      roman = /Ia\+|Ia-?0|Iab|Ia|Ib|III|II|IV|VII|VI|V|I/.exec(m[3])?.[0],
      prefix = { sd: 'VI', esd: 'VI', usd: 'VI', d: 'V', g: 'III', sg: 'I', c: 'I' }[m[1]],
      luminosity = roman || prefix;
    if (!luminosity) return feminine;
    if (luminosity === 'VII') return 'белый карлик';
    if (luminosity === 'V')
      return 'OBA'.includes(m[2]) ? feminine + ', главной последовательности' : masculine + ' карлик';
    return (
      masculine +
      ' ' +
      (/^Ia(?:\+|-?0)$/.test(luminosity)
        ? 'гипергигант'
        : { II: 'яркий гигант', III: 'гигант', IV: 'субгигант', VI: 'субкарлик' }[luminosity] ||
          'сверхгигант')
    );
  },
  spectralClass(o) {
    if (!['star', 'home'].includes(o?.kind) || o.synthetic || o.nuclearStar) return '';
    const curated = String(o.facts?.class || '').split(' · ');
    return String(
      o.spectral ||
        curated.find((part) =>
          /^(?:W[NCO]\d|WD$|D[A-Z]|[LTY]\d|(?:sd|d|g)?[OBAFGKM](?:\d|$))/.test(part.trim()),
        ) ||
        '',
    ).trim();
  },
  curatedStarType(o) {
    const parts = String(o.facts?.class || '')
        .split(' · ')
        .map((part) => part.trim()),
      head = parts[0] || '';
    if (/[а-яё]/.test(head) && /карлик|гигант/i.test(head)) return head.toLocaleLowerCase('ru');
    const words = parts.find(
      (part) =>
        /^[А-Яа-яЁё ,—-]+$/.test(part) &&
        !/^(?:именованная )?звезда$/i.test(part) &&
        !/компонент|компаньон|систем|спектр|орбит/i.test(part),
    );
    return words
      ? words.toLocaleLowerCase('ru').replace('вольфа — райе', 'Вольфа — Райе')
      : '';
  },
  galaxyType(text) {
    const s = String(text || '').trim();
    return /^d?Sph/.test(s)
      ? 'карликовая сфероидальная'
      : /^dE/.test(s)
        ? 'карликовая эллиптическая'
        : /^E(?![-/]S0)/.test(s)
          ? 'эллиптическая'
          : /^(?:E[-/])?S0/.test(s)
            ? 'линзовидная'
            : /^SB/.test(s)
              ? 'спиральная с перемычкой'
              : /^SAB/.test(s)
                ? 'спиральная со слабой перемычкой'
                : /^S[A-Za-z]/.test(s)
                  ? 'спиральная'
                  : /^I/.test(s)
                    ? 'неправильная'
                    : '';
  },
  subtype(o) {
    if (!o) return '';
    if (['star', 'home'].includes(o.kind)) {
      if (o.synthetic || o.nuclearStar) return '';
      const curated = this.curatedStarType(o);
      return /карлик|гигант/.test(curated)
        ? curated
        : this.starType(this.spectralClass(o)) || curated;
    }
    if (o.kind !== 'galaxy' || this.typeName(o) !== 'Галактика') return '';
    const curated = this.classText(o).split(' · ')[0];
    return (
      this.galaxyType(o.hubbleType) ||
      (curated !== 'Галактика' && /галактик/i.test(curated) ? curated.toLocaleLowerCase('ru') : '')
    );
  },
  typeLabel(o) {
    const type = this.typeName(o),
      subtype = this.subtype(o);
    return !subtype
      ? type
      : (type === 'Звезда' && /звезда/.test(subtype)) || (type === 'Галактика' && /галактик/.test(subtype))
        ? subtype[0].toLocaleUpperCase('ru') + subtype.slice(1)
        : type + ' · ' + subtype;
  },
  age(o) {
    if (!o || !['star', 'home'].includes(o.kind) || o.synthetic || o.nuclearStar) return null;
    if (typeof STAR_AGES === 'undefined') return null;
    const own = STAR_AGES.objects[o.id];
    if (own)
      return { age: own.age, lower: 0, upper: 0, digits: own.digits || 2, source: own, composite: false, models: 0 };
    if (!this.ageIndex) {
      this.ageIndex = new Map();
      for (let i = 0; i < STAR_AGES.rows.length; i += 6) this.ageIndex.set(STAR_AGES.rows[i], i);
    }
    const at = this.ageIndex.get(Number(o.hip)),
      r = STAR_AGES.rows;
    if (at === undefined || !o.hip) return null;
    const source = STAR_AGES.sources[r[at + 1]];
    return {
      age: r[at + 2],
      lower: r[at + 3],
      upper: r[at + 4],
      digits: 2,
      source,
      composite: source.key === 'casagrande2011' && r[at + 5] === 1,
      models: source.key === 'luck2015' ? r[at + 5] : 0,
    };
  },
  designationData: {
    greek:
      'Alp:α:Альфа:alpha,alf|Bet:β:Бета:beta|Gam:γ:Гамма:gamma|Del:δ:Дельта:delta|Eps:ε:Эпсилон:epsilon|Zet:ζ:Дзета:zeta|Eta:η:Эта|The:θ:Тета:theta,tet|Iot:ι:Йота:iota|Kap:κ:Каппа:kappa|Lam:λ:Лямбда:lambda,ламбда|Mu:μ:Мю|Nu:ν:Ню|Xi:ξ:Кси:ksi|Omi:ο:Омикрон:omicron|Pi:π:Пи|Rho:ρ:Ро|Sig:σ:Сигма:sigma|Tau:τ:Тау|Ups:υ:Ипсилон:upsilon|Phi:φ:Фи|Chi:χ:Хи:khi|Psi:ψ:Пси|Ome:ω:Омега:omega',
    constellations:
      'And:Андромеды:Andromedae|Ant:Насоса:Antliae|Aps:Райской Птицы:Apodis|Aqr:Водолея:Aquarii|Aql:Орла:Aquilae|Ara:Жертвенника:Arae|Ari:Овна:Arietis|Aur:Возничего:Aurigae|Boo:Волопаса:Bootis|Cae:Резца:Caeli|Cam:Жирафа:Camelopardalis|Cnc:Рака:Cancri|CVn:Гончих Псов:Canum Venaticorum|CMa:Большого Пса:Canis Majoris|CMi:Малого Пса:Canis Minoris|Cap:Козерога:Capricorni|Car:Киля:Carinae|Cas:Кассиопеи:Cassiopeiae|Cen:Центавра:Centauri|Cep:Цефея:Cephei|Cet:Кита:Ceti|Cha:Хамелеона:Chamaeleontis|Cir:Циркуля:Circini|Col:Голубя:Columbae|Com:Волос Вероники:Comae Berenices|CrA:Южной Короны:Coronae Australis|CrB:Северной Короны:Coronae Borealis|Crt:Чаши:Crateris|Cru:Южного Креста:Crucis|Crv:Ворона:Corvi|Cyg:Лебедя:Cygni|Del:Дельфина:Delphini|Dor:Золотой Рыбы:Doradus|Dra:Дракона:Draconis|Equ:Малого Коня:Equulei|Eri:Эридана:Eridani|For:Печи:Fornacis|Gem:Близнецов:Geminorum|Gru:Журавля:Gruis|Her:Геркулеса:Herculis|Hor:Часов:Horologii|Hya:Гидры:Hydrae|Hyi:Южной Гидры:Hydri|Ind:Индейца:Indi|Lac:Ящерицы:Lacertae|Leo:Льва:Leonis|LMi:Малого Льва:Leonis Minoris|Lep:Зайца:Leporis|Lib:Весов:Librae|Lup:Волка:Lupi|Lyn:Рыси:Lyncis|Lyr:Лиры:Lyrae|Men:Столовой Горы:Mensae|Mic:Микроскопа:Microscopii|Mon:Единорога:Monocerotis|Mus:Мухи:Muscae|Nor:Наугольника:Normae|Oct:Октанта:Octantis|Oph:Змееносца:Ophiuchi|Ori:Ориона:Orionis|Pav:Павлина:Pavonis|Peg:Пегаса:Pegasi|Per:Персея:Persei|Phe:Феникса:Phoenicis|Pic:Живописца:Pictoris|Psc:Рыб:Piscium|PsA:Южной Рыбы:Piscis Austrini|Pup:Кормы:Puppis|Pyx:Компаса:Pyxidis|Ret:Сетки:Reticuli|Sge:Стрелы:Sagittae|Sgr:Стрельца:Sagittarii|Sco:Скорпиона:Scorpii|Scl:Скульптора:Sculptoris|Sct:Щита:Scuti|Ser:Змеи:Serpentis|Sex:Секстанта:Sextantis|Tau:Тельца:Tauri|Tel:Телескопа:Telescopii|TrA:Южного Треугольника:Trianguli Australis|Tri:Треугольника:Trianguli|Tuc:Тукана:Tucanae|UMa:Большой Медведицы:Ursae Majoris|UMi:Малой Медведицы:Ursae Minoris|Vel:Парусов:Velorum|Vir:Девы:Virginis|Vol:Летучей Рыбы:Volantis|Vul:Лисички:Vulpeculae',
  },
  designationCache: new WeakMap(),
  designationTables() {
    if (this.designationIndex) return this.designationIndex;
    const letters = new Map(),
      letterKeys = new Map(),
      constellations = new Map(),
      constellationKeys = new Map();
    for (const row of this.designationData.greek.split('|')) {
      const [code, symbol, word, extra = ''] = row.split(':');
      letters.set(code, { symbol, word });
      for (const token of [code, symbol, word, ...extra.split(',')])
        if (token) letterKeys.set(this.searchKey(token), code);
    }
    for (const row of this.designationData.constellations.split('|')) {
      const [code, genitive, latin] = row.split(':');
      constellations.set(code, genitive);
      for (const token of [code, genitive, latin]) constellationKeys.set(this.searchKey(token), code);
    }
    return (this.designationIndex = {
      letters,
      constellations,
      constellationKeys,
      letterKeys: [...letterKeys].sort((a, b) => b[0].length - a[0].length),
      raw: new RegExp(
        '^(\\d{1,3})?\\s*(?:(' +
          [...letters.keys()].join('|') +
          ')\\s*(\\d)?)?\\s*(' +
          [...constellations.keys()].join('|') +
          ')$',
      ),
    });
  },
  designationParse(text) {
    const m = this.designationTables().raw.exec(String(text || '').trim());
    return m && (m[1] || m[2])
      ? { flamsteed: m[1] || '', letter: m[2] || '', index: m[3] || '', constellation: m[4] }
      : null;
  },
  designationOf(o) {
    if (!o || o.kind !== 'star' || o.synthetic || o.nuclearStar) return null;
    const cached = this.designationCache.get(o);
    if (cached && cached.name === o.name && cached.aliases === o.aliases) return cached.value;
    let value = null;
    for (const text of [o.name, ...(o.aliases || [])]) if ((value = this.designationParse(text))) break;
    this.designationCache.set(o, { name: o.name, aliases: o.aliases, value });
    return value;
  },
  designationIndexText(index) {
    return index ? '⁰¹²³⁴⁵⁶⁷⁸⁹'[index] : '';
  },
  designationName(d) {
    const t = this.designationTables(),
      place = t.constellations.get(d.constellation);
    return d.letter
      ? t.letters.get(d.letter).word + this.designationIndexText(d.index) + ' ' + place
      : d.flamsteed + ' ' + place;
  },
  designationNotation(d) {
    const t = this.designationTables(),
      place = t.constellations.get(d.constellation);
    return [
      d.letter ? t.letters.get(d.letter).symbol + this.designationIndexText(d.index) + ' ' + place : '',
      d.flamsteed ? d.flamsteed + ' ' + place : '',
    ].filter(Boolean);
  },
  designationText(o) {
    const d = this.designationOf(o);
    return d
      ? this.designationNotation(d)
          .filter((text) => text !== o.name && !o.name.startsWith(text + ' '))
          .join(' · ')
      : '';
  },
  designationDisplay(name) {
    const d = this.designationParse(name);
    return d ? this.designationName(d) : name;
  },
  designationQuery(text) {
    const t = this.designationTables(),
      m = /^(\d{1,3})?(\D.*)$/.exec(this.searchKey(String(text || '')));
    if (!m) return null;
    const flamsteed = m[1] || '',
      found = (letter, index, constellation) => {
        const code = letter.toLowerCase(),
          place = constellation.toLowerCase();
        return {
          flamsteed,
          letter,
          index,
          constellation,
          pattern:
            '\\|' +
            (flamsteed || '\\d{0,3}') +
            (letter ? code + (index || '\\d?') : '(?:[a-z]{2,3}\\d?)?') +
            place +
            '\\|',
        };
      };
    for (const [token, letter] of t.letterKeys) {
      if (!m[2].startsWith(token)) continue;
      const tail = /^(\d)?(\D+)$/.exec(m[2].slice(token.length)),
        constellation = tail && t.constellationKeys.get(tail[2]);
      if (constellation) return found(letter, tail[1] || '', constellation);
    }
    const constellation = flamsteed && t.constellationKeys.get(m[2]);
    return constellation ? found('', '', constellation) : null;
  },
  designationMatches(o, q) {
    const d = this.designationOf(o);
    return (
      !!d &&
      d.constellation === q.constellation &&
      (!q.flamsteed || d.flamsteed === q.flamsteed) &&
      (!q.letter || (d.letter === q.letter && (!q.index || d.index === q.index)))
    );
  },
  description(o) {
    return o.synthetic
      ? o.desc
      : (o.desc || '')
          .replace(/^Реальная каталожная запись [^.]+\.\s*/, '')
          .replace(/^Реальный объект:\s*[^.]+\.\s*/, '');
  },
  importMethods: null,
  lead(o) {
    const text = this.description(o);
    if (o.synthetic || !text) return text;
    if (!this.importMethods)
      this.importMethods = new Set(
        typeof IMPORTED_CATALOG === 'undefined'
          ? []
          : IMPORTED_CATALOG.objects.map((e) => e.distanceMethod).filter(Boolean),
      );
    const method = String(o.distanceMethod || '').trim();
    return o.streamed || this.importMethods.has(o.desc) || (method && text.trim().startsWith(method))
      ? ''
      : text;
  },
  explainers: {
    'Пульсар · нейтронная звезда': [
      'Что такое пульсар',
      'Пульсар — нейтронная звезда: ядро массивной звезды, сжавшееся после взрыва сверхновой в шар поперечником около 20 км. Она вращается с периодом от тысячных долей секунды до нескольких секунд, и её узкие пучки излучения пробегают по Земле, как луч маяка, — отсюда строго ритмичные импульсы.',
    ],
    'Планетарная туманность': [
      'Что такое планетарная туманность',
      'Планетарная туманность — газовая оболочка, которую сбрасывает в конце жизни звезда вроде Солнца. Обнажившееся горячее ядро, будущий белый карлик, заставляет газ светиться. К планетам она отношения не имеет: название закрепилось из-за сходства с дисками планет в ранних телескопах.',
    ],
    'Эмиссионная туманность': [
      'Что такое эмиссионная туманность',
      'Эмиссионная туманность — облако газа, которое светится само. Ультрафиолет горячих звёзд ионизует водород, и тот излучает свет, в основном красный.',
    ],
    'Отражательная туманность': [
      'Что такое отражательная туманность',
      'Отражательная туманность — облако пыли, которое само не светится, а рассеивает свет ближайших звёзд. Синий свет рассеивается сильнее, поэтому такие туманности обычно голубые.',
    ],
    'Остаток сверхновой': [
      'Что такое остаток сверхновой',
      'Остаток сверхновой — расширяющаяся оболочка вещества, выброшенного при взрыве звезды. Ударная волна нагревает окружающий газ, и он светится ещё десятки тысяч лет.',
    ],
    'Область ионизированного водорода · туманность': [
      'Что такое область ионизированного водорода',
      'Область ионизированного водорода — облако газа вокруг молодых горячих звёзд. Их ультрафиолет ионизует водород и заставляет его светиться; в таких облаках продолжают рождаться звёзды.',
    ],
    'Туманность': [
      'Что такое туманность',
      'Туманность — облако межзвёздного газа и пыли. Одни туманности светятся под излучением горячих звёзд, другие отражают их свет, третьи видны тёмными силуэтами на светлом фоне.',
    ],
    'Рассеянное звёздное скопление': [
      'Что такое рассеянное скопление',
      'Рассеянное скопление — от десятков до нескольких тысяч звёзд, родившихся вместе из одного облака. Притяжение держит их слабо, и за сотни миллионов лет скопление постепенно расходится.',
    ],
    'Шаровое звёздное скопление': [
      'Что такое шаровое скопление',
      'Шаровое скопление — плотный шар из десятков и сотен тысяч старых звёзд, связанных взаимным притяжением. Такие скопления обращаются вокруг галактик; большинству из них больше десяти миллиардов лет.',
    ],
    'Звёздная ассоциация': [
      'Что такое звёздная ассоциация',
      'Звёздная ассоциация — разреженная группа молодых звёзд общего происхождения. Взаимное притяжение её не удерживает, и за десятки миллионов лет звёзды расходятся.',
    ],
    'Звёздное скопление с туманностью': [
      'Что такое скопление с туманностью',
      'Звёздное скопление с туманностью — молодые звёзды вместе с остатками облака, из которого они родились. Излучение звёзд подсвечивает этот газ и постепенно его рассеивает.',
    ],
    'Звёздное скопление': [
      'Что такое звёздное скопление',
      'Звёздное скопление — группа звёзд, родившихся вместе из одного облака и связанных взаимным притяжением.',
    ],
    'Оптическая группа': [
      'Что такое оптическая группа',
      'Оптическая группа, или астеризм, — звёзды, которые с Земли видны рядом, но находятся на разных расстояниях и не связаны притяжением. Это узор на небе, а не скопление.',
    ],
    'Протоскопление': [
      'Что такое протоскопление',
      'Протоскопление — сгущение галактик в ранней Вселенной, из которого со временем может вырасти скопление галактик. Мы видим его таким, каким оно было миллиарды лет назад.',
    ],
    'Скопление галактик': [
      'Что такое скопление галактик',
      'Скопление галактик — сотни и тысячи галактик, связанных общим притяжением. Большая часть его массы приходится на тёмную материю и горячий газ между галактиками.',
    ],
    'Группа галактик': [
      'Что такое группа галактик',
      'Группа галактик — до нескольких десятков галактик, связанных притяжением. Млечный Путь входит в такую же Местную группу.',
    ],
    'Сверхскопление галактик': [
      'Что такое сверхскопление',
      'Сверхскопление — группа скоплений галактик протяжённостью в сотни миллионов световых лет. Большинство сверхскоплений не связано притяжением и со временем растянется вместе с расширением Вселенной.',
    ],
    'Галактический филамент': [
      'Что такое галактический филамент',
      'Галактический филамент — вытянутая нить из галактик и газа, которая соединяет скопления. Из таких нитей и узлов состоит космическая паутина.',
    ],
    'Галактическая стена · мегаструктура': [
      'Что такое галактическая стена',
      'Галактическая стена — протяжённый слой из галактик и их скоплений на границе войдов. Это часть космической паутины, а не единое тело: притяжение не удерживает стену целиком.',
    ],
    'Космический войд': [
      'Что такое войд',
      'Космический войд — огромная область, где галактик во много раз меньше среднего. Войды занимают бóльшую часть объёма Вселенной, а галактики собраны в стенах и нитях между ними.',
    ],
    'Мегаструктура': [
      'Что такое мегаструктура',
      'Мегаструктура — образование из галактик, скоплений или квазаров протяжённостью от сотен миллионов световых лет. Такие области выделяют по обзорам неба; их границы условны, а самые крупные остаются кандидатами.',
    ],
    'Космологический горизонт': [
      'Что такое космологический горизонт',
      'Космологический горизонт — граница области, из которой свет успел дойти до нас за время существования Вселенной. Это не стена и не край пространства: у каждого наблюдателя свой горизонт.',
    ],
    'Квазар · активное ядро галактики': [
      'Что такое квазар',
      'Квазар — ядро далёкой галактики, в котором сверхмассивная чёрная дыра поглощает газ. Раскалённый диск вокруг неё светит ярче всех звёзд галактики вместе взятых, поэтому квазары видны за миллиарды световых лет.',
    ],
    'Сверхмассивная чёрная дыра': [
      'Что такое сверхмассивная чёрная дыра',
      'Сверхмассивная чёрная дыра — чёрная дыра массой от сотен тысяч до миллиардов масс Солнца. Такие есть в центрах почти всех крупных галактик. Сама она не светит: её находят по движению звёзд и газа вокруг.',
    ],
    'Чёрная дыра': [
      'Что такое чёрная дыра',
      'Чёрная дыра звёздной массы — остаток массивной звезды, сжавшейся в конце жизни. Её притяжение не выпускает даже свет, поэтому её находят по движению звезды-компаньона и по излучению газа, падающего на дыру.',
    ],
  },
  stellarExplainers: [
    [
      /цефеид/i,
      'Что такое цефеида',
      'Цефеида — пульсирующая звезда-гигант: она ритмично расширяется и сжимается, и её блеск меняется с постоянным периодом. Период связан со светимостью, поэтому по цефеидам измеряют расстояния до других галактик.',
    ],
    [
      /сверхгигант/i,
      'Что такое сверхгигант',
      'Сверхгигант — массивная звезда на поздней стадии жизни. Она раздулась в десятки или сотни раз шире Солнца и светит в тысячи раз ярче.',
    ],
    [
      /бел\S+ карлик/i,
      'Что такое белый карлик',
      'Белый карлик — остывающее ядро звезды, исчерпавшей топливо. Масса порядка солнечной сжата в шар размером с Землю.',
    ],
    [
      /красн\S+ карлик/i,
      'Что такое красный карлик',
      'Красный карлик — маленькая холодная звезда, в несколько раз легче Солнца и во много раз тусклее. Таких звёзд в Галактике большинство, но невооружённым глазом не видна ни одна.',
    ],
  ],
  explainer(o) {
    if (!o || o.synthetic) return null;
    let found = this.explainers[this.typeName(o)];
    if (!found && o.kind === 'blackhole')
      found =
        this.explainers[
          (o.blackHolePopulation || o.population) === 'supermassive'
            ? 'Сверхмассивная чёрная дыра'
            : 'Чёрная дыра'
        ];
    if (!found) {
      const type = this.typeName(o).toLocaleLowerCase('ru'),
        key = {
          pulsar: 'Пульсар · нейтронная звезда',
          quasar: 'Квазар · активное ядро галактики',
          void: 'Космический войд',
          wall: 'Галактическая стена · мегаструктура',
          structure: 'Мегаструктура',
          ring: 'Мегаструктура',
          arc: 'Мегаструктура',
          nebula: type.includes('скоплени') ? 'Звёздное скопление с туманностью' : 'Туманность',
          cluster: type.includes('протоскоплен')
            ? 'Протоскопление'
            : type.includes('галактик')
              ? 'Скопление галактик'
              : type.includes('звёздное скопление')
                ? 'Звёздное скопление'
                : '',
        }[o.kind];
      found =
        this.explainers[
          /оптическая (?:пара|группа)|астеризм/.test(type)
            ? 'Оптическая группа'
            : type.includes('протоскоплен')
              ? 'Протоскопление'
              : key
        ];
    }
    if (!found && (o.kind === 'star' || o.kind === 'home')) {
      const cls = String(o.facts?.class || '');
      found = this.stellarExplainers.find(([pattern]) => pattern.test(cls))?.slice(1);
    }
    return found ? { title: found[0], text: found[1] } : null;
  },
  classText(o) {
    const type = this.typeName(o),
      raw = o.kind === 'blackhole' ? type : String(o.facts?.class || '').trim();
    if (!raw || /[а-яё]/.test(raw)) return raw || type;
    const head = raw.split(' · ')[0].trim(),
      label = (head[0] + head.slice(1).toLocaleLowerCase('ru')).replace('млечного пути', 'Млечного Пути');
    return type.toLocaleLowerCase('ru').includes(label.toLocaleLowerCase('ru')) ? type : label;
  },
  component(o) {
    return o.stellarComponent || { alpha: 'A', 'hyg-71453': 'B', proxima: 'C' }[o.id];
  },
  componentNote(o) {
    if (o.stellarSystem) {
      const s = ExtendedCatalog.systemByMember.get(o.id);
      return 'Компонент ' + o.stellarComponent + ' системы «' + s.name + '». В опубликованной иерархии ' + s.members.length +
        ' компонентов. ' + (s.pairs.some(p => !p.orbit) ? 'Для части пар полного набора орбитальных элементов нет; их связь не изображается прямой линией.' : 'На карте показаны опубликованные относительные орбиты.');
    }
    const c = this.component(o);
    return c
      ? 'Компонент ' +
          c +
          ' тройной системы Альфа Центавра. A и B образуют тесную пару; C — Проксима Центавра, её далёкий компаньон. Буквы A, B, C обозначают компоненты одной системы; Бета Центавра — другая звёздная система.'
      : '';
  },
  cleanName(o) {
    let name = (o.name || '')
      .replace(/\s*[·,]?\s*\b(?:NGC|IC)\s*\d+[A-Za-z]?\b/gi, '')
      .replace(/\s*[·,]\s*$/, '')
      .trim();
    const m = Number(o.messier);
    if (m && !/\bM\s*\d+/.test(name)) name += ' · M' + m;
    return name || o.name;
  },
  searchKey(s) {
    return s
      .normalize('NFKD')
      .toLocaleLowerCase('ru')
      .replace(/\p{M}/gu, '')
      .replace(/[^\p{L}\p{N}]/gu, '')
      .replace(/(ngc|ic)0+(?=\d)/g, '$1');
  },
  massInfo(o) {
    if (!o) return null;
    const cached = this.massCache.get(o), facts = o.facts, gravity = o.gravity;
    if (cached) {
      const key = cached.key;
      if (
        key[0] === o.massSolar &&
        key[1] === o.massUncertaintySolar &&
        key[2] === o.massSource &&
        key[3] === o.massIsSystem &&
        key[4] === facts?.mass &&
        key[5] === facts?.ref &&
        key[6] === gravity?.massSolar &&
        key[7] === gravity?.source &&
        key[8] === o.source
      )
        return cached.value;
    }
    const key = [
      o.massSolar,
      o.massUncertaintySolar,
      o.massSource,
      o.massIsSystem,
      facts?.mass,
      facts?.ref,
      gravity?.massSolar,
      gravity?.source,
      o.source,
    ];
    const value = this.computeMassInfo(o);
    this.massCache.set(o, { key, value });
    return value;
  },
  computeMassInfo(o) {
    if (!o) return null;
    if (Number.isFinite(o.massSolar) && o.massSolar > 0)
      return {
        solar: o.massSolar,
        ...(Number.isFinite(o.massUncertaintySolar) ? { uncertainty: o.massUncertaintySolar } : {}),
        source: o.massSource || o.facts?.ref || o.source || '',
        basis: 'Численная масса объекта',
        system: !!o.massIsSystem,
      };
    // This sourced layer explicitly distinguishes point estimates from bounds,
    // intervals and missing data. Its display text must never invent a point mass.
    if (o.blackHoleCatalog) return null;
    const txt = String(o.facts?.mass || '');
    // A typical neutron-star mass is not an individual measurement. In particular,
    // never take the uncertainty after ± as the central value of a catalogue mass.
    if (!/не измерена|типичн|ориентир|неизвест|не установлена|нет индивидуальн/i.test(txt)) {
      const compact = txt.replace(/(?<=\d)[\s\u00a0]+(?=\d)/g, ''),
        sup = {
          '⁰': '0',
          '¹': '1',
          '²': '2',
          '³': '3',
          '⁴': '4',
          '⁵': '5',
          '⁶': '6',
          '⁷': '7',
          '⁸': '8',
          '⁹': '9',
          '⁻': '-',
        },
        power = '[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+',
        num = '(?:[0-9]+(?:[.,][0-9]+)?(?:\\s*[·×]\\s*10' + power + ')?|10' + power + ')';
      const m = compact.match(
        new RegExp(
          '(' + num + ')(?:\\s*(±|[–−-]|\\+)\\s*(' + num + '))?(?:\\s*(тыс|млн|млрд))?\\s*M☉',
        ),
      );
      if (m) {
        const parse = (s) => {
            const a = s
              .replace(',', '.')
              .replace(/\s/g, '')
              .split(/[·×]10/);
            return a.length > 1
              ? Number(a[0]) * 10 ** Number([...a[1]].map((c) => sup[c] ?? c).join(''))
              : /^10[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+$/.test(s)
                ? 10 ** Number([...s.slice(2)].map((c) => sup[c] ?? c).join(''))
                : Number(a[0]);
          },
          factor = { тыс: 1e3, млн: 1e6, млрд: 1e9 }[m[4]] || 1,
          a = parse(m[1]) * factor,
          b = m[3] ? parse(m[3]) * factor : null,
          range = m[2] && m[2] !== '±' && m[2] !== '+';
        const solar = m[2] === '+' ? a + b : range ? (a + b) / 2 : a;
        if (solar > 0 && Number.isFinite(solar))
          return {
            solar,
            uncertainty: m[2] === '±' ? b : null,
            min: range ? Math.min(a, b) : null,
            max: range ? Math.max(a, b) : null,
            system: m[2] === '+',
            source: o.facts?.ref || o.source || '',
            basis: txt,
          };
      }
    }
    return Number.isFinite(o.gravity?.massSolar) && o.gravity.massSolar > 0
      ? {
          solar: o.gravity.massSolar,
          source: o.gravity.source || o.source || '',
          basis: 'Гравитационная модель объекта',
          system: false,
        }
      : null;
  },
  mass(o) {
    return this.massInfo(o)?.solar ?? null;
  },
  massOrder(a, b) {
    const ma = this.mass(a),
      mb = this.mass(b);
    return ma !== null && mb !== null ? mb - ma : ma !== null ? -1 : mb !== null ? 1 : 0;
  },
  group(o) {
    if (o.cosmicSubtype) return o.cosmicSubtype;
    if (o.kind === 'cluster') {
      if (o.catalogClass === 'stellar-cluster' || o.catalogClass === 'galaxy-cluster')
        return o.catalogClass;
      return /галактик/i.test([o.type, o.name, o.facts?.class].join(' '))
        ? 'galaxy-cluster'
        : 'stellar-cluster';
    }
    return o.kind;
  },
  mapLabelName(o, selected = false) {
    if (globalThis.MapFilters?.promotes(o) && !o.synthetic) return o.stellarLabel || o.mapLabel || o.name;
    // Selection may reveal the full designation; it never makes it a proper name.
    if (selected && !o.synthetic) return o.mapLabel || o.name;
    // Sourced stellar names include surname numbers (Wolf 359), Flamsteed
    // numbers (61 Cygni) and explicit component suffixes. Other classes keep
    // their proper-name rule, including the black-hole catalogue.
    if (o.kind === 'star' && o.stellarLabel && !o.synthetic) return o.stellarLabel;
    const group = this.group(o),
      key = [o.name, o.aliases, o.synthetic, o.galaxyMember, o.bulkGalaxyMember, group],
      cached = this.nameCache.get(o);
    if (cached && key.every((v, i) => v === cached.key[i])) return cached.value;
    // Member aliases also contain the host's name: it is not the star's name.
    const aliases = o.galaxyMember || o.bulkGalaxyMember ? [] : o.aliases || [];
    const generic =
      /^(?:звезда|зв[её]зд|галактика|галактик|скопление|сверхскопление|туманность|пульсар|квазар|ч[её]рная|дыра|филамент|нить|стена|войд|неизвестная|star|galaxy|cluster|supercluster|nebula|pulsar|quasar|black|hole|filament|wall|void|unknown|unnamed|HIP|HYG|HD|HR|GJ|GL|NGC|IC|PGC|UGC|MCXC|RXC|SDSS|OGLE|LGGS|PHAT|HSC|ATNF|PSR)$/i;
    const hostName = o.kind === 'blackhole' && /^Чёрная дыра\s*·/i.test(o.name)
      ? o.name.split('·')[1].trim() : null;
    const candidates = [o.name, ...aliases].flatMap((value) =>
      String(value || '')
        .split('·')
        .map((s) => s.trim()),
    );
    // Descriptive structure names may carry a survey qualifier, e.g. CfA2.
    const descriptive = ['wall', 'structure', 'ring', 'arc'].includes(group);
    const value = o.synthetic
      ? null
      : candidates.find(
          (name) =>
            /\p{L}/u.test(name) &&
            (!/[0-9]/.test(name) || descriptive) &&
            // Host names, variable-star codes and search descriptions are not
            // proper names of the black hole itself.
            !(o.kind === 'blackhole' && (name === hostName ||
              /^(?:[A-Z]{1,2}|V\d+)\s+[A-Z][A-Za-z]{2}$/.test(name) ||
              /ч[её]рн[а-яё]*\s+дыр|black\s+hole|первое\s+изображение|first\s+image/i.test(name))) &&
            name
              .split(/\s+/)
              .some((word) => /\p{L}/u.test(word) && !/[0-9]/.test(word) && !generic.test(word)),
        ) || null;
    this.nameCache.set(o, { key, value });
    return value;
  },
  levels: new Map([
    ['home', 0],
    ['star', 0],
    ['pulsar', 0],
    ['blackhole', 0],
    ['nebula', 1],
    ['stellar-cluster', 1],
    ['galaxy', 2],
    ['quasar', 2],
    ['galaxy-cluster', 3],
    ['filament', 4],
    ['supercluster', 4],
    ['structure', 4],
    ['wall', 4],
    ['ring', 4],
    ['arc', 4],
    ['void', 4],
    ['horizon', 4],
  ]),
  level(o) {
    return this.levels.get(this.group(o)) ?? 0;
  },
  // Sourced cosmological centres with no measured extent compete as points,
  // including on the overview. This is a display class, independent of survey
  // membership and of the signal/flight horizon.
  cosmologicalPoint(o) {
    return !!(
      !o.atlasOnly &&
      (o.cosmicLandmark || o.sizeUnknown) &&
      (o.kind === 'galaxy' || o.kind === 'quasar' ||
        (o.kind === 'cluster' && this.group(o) === 'galaxy-cluster')) &&
      o.cosmology?.distanceLy > 0 &&
      o.p3?.every(Number.isFinite)
    );
  },
  blackHoleHost(o) {
    if (o.kind !== 'blackhole') return null;
    const id = o.parentGalaxy ||
      ((o.blackHolePopulation || o.population) === 'supermassive'
        ? GalaxyRegistry.hostOf(o.id)?.id
        : null);
    const host = id && (globalThis.BlackHoleCatalog?.hosts.get(id) ||
      (typeof ExtendedCatalog === 'undefined' ? null : ExtendedCatalog.get(id)));
    return host?.kind === 'galaxy' ? host : null;
  },
  maxSpan(o) {
    // One cutoff per scale class. Compact landmarks use the same boundary,
    // then compete for empty screen space in the final label pass.
    if (o.synthetic) return 2000;
    if (o.kind === 'blackhole') {
      if ((o.blackHolePopulation || o.population) !== 'supermassive')
        return o.notableLandmark ? 150000 : 2000;
      const host = this.blackHoleHost(o),
        diameter = host?.galaxy?.diameterLy || host?.diameterLy || o.hostDiameterLy,
        // A nucleus is an interior detail: resolve the host to about 180 CSS px
        // at the 1440px reference width. Distance from Earth never enlarges it.
        span = diameter > 0 ? diameter * 8 : 1e6;
      return Math.min(span, host ? this.maxSpan(host) * 0.7 : 1e6);
    }
    // Every resolved population retains its host scale. Larger local objects
    // also keep their own class range; adding a host cannot shorten that range.
    const hostSpan = o.galaxyMember
      ? (o.hostDiameterLy || 30000) * 5
      : o.bulkGalaxyMember && o.positionEstimate?.referenceScaleLy > 0
        ? o.positionEstimate.referenceScaleLy * 5
        : 0;
    if (hostSpan) return Math.max(hostSpan, this.level(o) === 1 ? 300000 : 0);
    if (o.positionQuality === 'unknown') return Infinity;
    if (o.cosmicLandmark && this.level(o) >= 4) return Infinity;
    if (o.galaxy && !o.streamed) return 3e9;
    if (this.group(o) === 'stellar-cluster' || o.kind === 'nebula') return 300000;
    if (this.group(o) === 'galaxy-cluster') return 2e9;
    if (o.kind === 'home') return 600;
    if (o.kind === 'star' || o.kind === 'pulsar') return 2000;
    if (o.kind === 'galaxy' || o.kind === 'quasar') return 3e8;
    return Infinity;
  },
  origin(o) {
    return o.id === 'sol' || o.kind === 'home';
  },
  // Visibility metadata uses reference-epoch ly/pixel. Expanding envelopes and
  // sourced overview points keep the same screen window as their geometry.
  lodScale(o) {
    if (!o.kind && o.id) o = ExtendedCatalog.get(o.id) || o;
    const host = this.blackHoleHost(o);
    if (host) return this.lodScale(host);
    return globalThis.MapVisibility?.overviewPoint(o)
      ? Cosmology.scale()
      : Cosmology.regionScale(o);
  },
  // Match the fixed hierarchy's 1440px reference ranges in the fallback too.
  // Ruler rounding never changes the visibility of the network.
  opacity(o, span, viewportWidth = width) {
    if (globalThis.MapFilters?.collapsedStar(o, span)) return 0;
    if (globalThis.MapFilters?.promotes(o)) return 1;
    if (ExtendedCatalog.isSystemMember(o)) return 1;
    if (this.origin(o)) return 1;
    const cache = span === this.frameSpan && viewportWidth === this.frameWidth ? this.frameOpacity : null,
      cached = cache?.get(o);
    if (cached !== undefined) return cached;
    const limit = globalThis.MapVisibility?.active ? MapVisibility.limit(o) : Infinity,
      value = limit !== Infinity
        ? MapVisibility.opacity(o, span, viewportWidth, limit)
        : this.classOpacity(o, span, viewportWidth);
    cache?.set(o, value);
    return value;
  },
  classOpacity(o, span, viewportWidth = width) {
    if (this.origin(o)) return 1;
    span /= this.lodScale(o);
    if (this.group(o) === 'filament') {
      const end = (2.7e9 * viewportWidth) / 1440,
        t = Math.max(0, Math.min(1, (span / end - 0.6) / 0.4));
      return 1 - t * t * (3 - 2 * t);
    }
    const max = this.maxSpan(o);
    if (span >= max) return 0;
    if (span <= max * 0.8) return 1;
    const t = (span / max - 0.8) / 0.2;
    return 1 - t * t * (3 - 2 * t);
  },
  landmark(o) {
    return (
      !o.atlasOnly &&
      !o.synthetic &&
      !o.bulkGalaxyMember &&
      !o.nuclearStar &&
      o.p3?.every(Number.isFinite) &&
      Number.isFinite(this.maxSpan(o)) &&
      !!(
        o.cosmicLandmark ||
        o.messier ||
        (!o.streamed && ExtendedCatalog.coreIndex?.has(o.id) && !ExtendedCatalog.background(o))
      )
    );
  },
  discoverable(o) {
    return !!(
      !o.atlasOnly &&
      !o.synthetic &&
      !o.nuclearStar &&
      o.positionQuality !== 'unknown' &&
      o.navigable !== false &&
      o.p3?.length === 3 &&
      o.p3.every(Number.isFinite) &&
      Number.isFinite(this.maxSpan(o))
    );
  },
  sparse(o, span) {
    if (globalThis.MapFilters?.collapsedStar(o, span)) return false;
    if (this.origin(o) || o.kind === 'blackhole' || globalThis.MapVisibility?.active) return false;
    return span > this.maxSpan(o) * 0.8 && this.discoverable(o);
  },
  visible(o, span, viewportWidth) {
    if (o.atlasOnly) return false;
    return this.opacity(o, span, viewportWidth) > 0.03;
  },
};
for (const o of OBJECTS) {
  const name = MapDetails.cleanName(o);
  if (name !== o.name) {
    o.aliases = [...new Set([...(o.aliases || []), o.name])];
    o.name = name;
  }
  if (o.galaxy) o.galaxy.name = o.name;
}
// Real catalogue details fill gaps only after all ordinary glyphs and labels.
// Cache structural geometry with its render cache; index point glyphs per pass.
const MapLandmarks = {
  cache: null,
  points: null,
  ui: null,
  prepared: false,
  box(points) {
    let x = Infinity,
      y = Infinity,
      right = -Infinity,
      bottom = -Infinity;
    for (const p of points) {
      x = Math.min(x, p.x);
      y = Math.min(y, p.y);
      right = Math.max(right, p.x);
      bottom = Math.max(bottom, p.y);
    }
    return { x, y, w: right - x, h: bottom - y };
  },
  cells(box, visit) {
    const x0 = Math.max(-1, Math.floor(box.x / 64)),
      x1 = Math.min(Math.ceil(width / 64), Math.floor((box.x + box.w) / 64)),
      y0 = Math.max(-1, Math.floor(box.y / 64)),
      y1 = Math.min(Math.ceil(height / 64), Math.floor((box.y + box.h) / 64));
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++) visit(x + 1 + (y + 1) * (Math.ceil(width / 64) + 3));
  },
  insert(grid, item) {
    this.cells(item.box, (key) => {
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(item);
    });
  },
  query(grid, box) {
    const found = new Set();
    this.cells(box, (key) => {
      for (const item of grid.get(key) || []) found.add(item);
    });
    return found;
  },
  occupied(box) {
    let found = false;
    this.cells(box, (key) => {
      if (found) return;
      for (const item of this.points.get(key) || [])
        if (MapLabels.overlaps(box, item.box)) {
          found = true;
          break;
        }
    });
    return found;
  },
  prepare() {
    if (this.prepared) return;
    this.prepared = true;
    if (!this.points) {
      this.points = new Map();
      for (const h of hitObjects) this.reserve(h);
    }
    const scale = Cosmology.scale(),
      key = MapLabels.viewKey + ':' + MapLabels.contours.map((q) => q.id).join(','),
      cache = this.cache;
    const shift = cache
      ? Math.abs(scale / cache.scale - 1) *
        (2 + Math.hypot(cam.x, cam.y) / cam.span) *
        Math.max(width, height)
      : Infinity;
    if (cache && cache.key === key && cache.hits === RegionMap.hits && shift < 0.15) return;
    const grid = new Map();
    for (const h of [...RegionMap.hits, ...MapLabels.contours]) {
      // Galaxy outlines are background for compact contents. Their actual glyphs
      // and labels already reserve space when the contents cannot be resolved.
      const container = !!h.container;
      const paths = h.paths || [{points:h.points,closed:h.closed}];
      const segments = h.segments || paths.flatMap(path => path.points.slice(1).map((p, i) => [path.points[i], p]).concat(path.closed ? [[path.points.at(-1),path.points[0]]] : []));
      // Separate segment bounds avoid filling a large filament's empty bounding box.
      for (const pair of segments) this.insert(grid, { box: this.box(pair), pair, container });
      if (h.closed) this.insert(grid, { box: this.box(h.points), paths, container });
    }
    this.cache = { key, scale, hits: RegionMap.hits, grid };
  },
  reserve({ p, r = 23 }) {
    this.insert(this.points, { box: { x: p.x - r, y: p.y - r, w: 2 * r, h: 2 * r } });
  },
  contains(p, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const a = polygon[i],
        b = polygon[j];
      if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x)
        inside = !inside;
    }
    return inside;
  },
  crosses([a, b], box) {
    let lo = 0,
      hi = 1;
    const dx = b.x - a.x,
      dy = b.y - a.y;
    for (const [p, q] of [
      [-dx, a.x - box.x],
      [dx, box.x + box.w - a.x],
      [-dy, a.y - box.y],
      [dy, box.y + box.h - a.y],
    ]) {
      if (p === 0) {
        if (q < 0) return false;
      } else {
        const t = q / p;
        if (p < 0) lo = Math.max(lo, t);
        else hi = Math.min(hi, t);
        if (lo > hi) return false;
      }
    }
    return true;
  },
  clear(box, object) {
    if (this.occupied(box)) return false;
    for (const h of this.query(this.cache.grid, box)) {
      if (h.container && object && MapDetails.level(object) < 2) continue;
      if (
        h.pair
          ? this.crosses(h.pair, box)
          : h.paths.reduce((inside,path) => path.closed && this.contains({ x: box.x + box.w / 2, y: box.y + box.h / 2 }, path.points) ? !inside : inside,false)
      )
        return false;
    }
    return true;
  },
  available(p, object) {
    const guard = { x: p.x - 48, y: p.y - 48, w: 96, h: 96 },
      symbol = { x: p.x - 24, y: p.y - 24, w: 48, h: 48 };
    // Labels reserve broad stable columns. Small glyphs can also use the visible
    // gaps beside a compact card or collapsed controls, without entering the UI.
    if (!this.ui) {
      this.ui = [
        ...document.querySelectorAll(
          '.map-heading,.map-actions,.map-controls,.flight-card,.map-scale,.ship-location,.catalog-drawer,.menu-popover',
        ),
      ]
        .map((e) => e.getBoundingClientRect())
        .filter((r) => r.width > 0 && r.height > 0)
        .map((r) => ({ x: r.left - 4, y: r.top - 4, w: r.width + 8, h: r.height + 8 }));
      if (!this.ui.length) this.ui = MapLabels.boxes.slice(0, MapLabels.uiCount);
    }
    if (this.ui.some((b) => MapLabels.overlaps(symbol, b))) return false;
    this.prepare();
    if (!this.clear(guard, object)) return false;
    return !MapLabels.boxes.slice(MapLabels.uiCount).some((b) => MapLabels.overlaps(guard, b));
  },
  labelClear(box, object) {
    return this.clear({ x: box.x - 8, y: box.y - 8, w: box.w + 16, h: box.h + 16 }, object);
  },
};
const MapLabels = {
  // Text widths survive frames, but not a font load. Bound changing flight
  // captions so a long expedition cannot grow this cache indefinitely.
  metrics: new Map(),
  measure(value, font) {
    const key = font + '\u0000' + value,
      known = this.metrics.get(key);
    if (known !== undefined) return known;
    ctx.font = font;
    const valueWidth = ctx.measureText(value).width;
    if (this.metrics.size >= 2048) this.metrics.clear();
    this.metrics.set(key, valueWidth);
    return valueWidth;
  },
  queue: [],
  boxes: [],
  placed: [],
  contours: [],
  slots: new Map(),
  viewKey: null,
  areaGeometry: null,
  emphasized(o) {
    return !!o && (hover?.id === o.id || state.selected === (o.navigationId || o.id));
  },
  geometry() {
    if (!this.areaGeometry) {
      this.areaGeometry = new Map((typeof RegionMap === 'undefined' ? [] : RegionMap.hits).map(h => [h.o.id, {...h, object:h.o}]));
      for (const h of this.contours) if (h.object) this.areaGeometry.set(h.id, h);
      // Interior picking needs an outline on the actual canvas. A galaxy can
      // surround a close stellar view, and cached regions include offscreen
      // padding; neither should turn the whole viewport into a hidden target.
      const viewport = {x:0, y:0, w:width, h:height};
      for (const [id, h] of this.areaGeometry) {
        const paths = h.paths || [{points:h.points, closed:h.closed}];
        if (!h.closed || !paths.some(path => path.closed && path.points.some((p, i) =>
          MapLandmarks.crosses([p, path.points[(i + 1) % path.points.length]], viewport)
        ))) this.areaGeometry.delete(id);
      }
    }
    return this.areaGeometry;
  },
  areaHit(x, y) {
    let found = null, smallest = Infinity;
    for (const h of this.geometry().values()) {
      if (!h.closed || h.object.region?.shape === 'ring') continue;
      const box = MapLandmarks.box(h.points);
      if (box.w*box.h >= smallest || x < box.x || x > box.x+box.w || y < box.y || y > box.y+box.h) continue;
      if ((h.paths||[{points:h.points}]).reduce((inside,path)=>MapLandmarks.contains({x,y},path.points)?!inside:inside,false)) { found = h.object; smallest = box.w*box.h; }
    }
    return found;
  },
  leader(box, anchor, alpha = 1, active = false) {
    if (!anchor || !Number.isFinite(anchor.x+anchor.y)) return;
    const from = {x:clamp(anchor.x,box.x,box.x+box.w),y:clamp(anchor.y,box.y,box.y+box.h)};
    if (Math.hypot(anchor.x-from.x,anchor.y-from.y) < 5) return;
    ctx.save();ctx.globalAlpha=alpha*(active ? .95 : .8);
    line(from.x,from.y,anchor.x,anchor.y,active?'#252525':'#646464',active?1:.7);
    circle(anchor.x,anchor.y,1.6,active?'#252525':'#646464',.8);
    ctx.restore();
    return {from,to:anchor};
  },
  dynamic(key) {
    return (
      key === 'ship' ||
      key === 'ship-reach' ||
      key === 'light-reach' ||
      key.startsWith('flight-mark-')
    );
  },
  overlaps(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  },
  intersectsViewport(box) {
    return this.overlaps(box, {x:0,y:0,w:width,h:height});
  },
  begin() {
    const key = [
      cam.x,
      cam.y,
      cam.span,
      width,
      height,
      state.selected,
      state.flight?.fromId || state.current,
    ].join(':');
    if (this.viewKey !== key) {
      this.slots.clear();
      this.viewKey = key;
    }
    this.queue = [];
    this.placed = [];
    this.contours = [];
    this.areaGeometry = null;
    MapLandmarks.points = null;
    MapLandmarks.ui = null;
    MapLandmarks.prepared = false;
    this.boxes = [
      { x: 0, y: 0, w: Math.min(width - 30, 430), h: 150 },
      { x: width - 300, y: 0, w: 300, h: 80 },
      { x: 0, y: height - 45, w: width, h: 45 },
      { x: 0, y: height - 200, w: 80, h: 200 },
      { x: 0, y: 132, w: width < 700 ? 224 : 185, h: 480 },
    ];
    // Reserve the card's column independently of its changing telemetry height.
    if (width >= 700) {
      const column = (width <= 1050 ? 300 : 310) + 40;
      this.boxes.push({ x: width - column, y: 68, w: column, h: height - 68 });
    } else {
      const r = $('flightCard').getBoundingClientRect();
      this.boxes.push({
        x: r.left - 12,
        y: Math.min(r.top - 8, height * 0.45),
        w: r.width + 24,
        h: height,
      });
    }
    this.uiCount = this.boxes.length;
  },
  add(label) {
    this.queue.push(label);
  },
  point({
    key,
    name,
    detail,
    p,
    object,
    mass = null,
    level = 0,
    priority = 20,
    selected = false,
    opacity = 1,
    size,
    sparse = false,
    onPlace,
  }) {
    this.add({
      key,
      name,
      detail,
      object,
      mass,
      level,
      priority,
      size: size || (selected ? 12 : 10),
      opacity,
      sparse,
      p,
      onPlace,
      color: selected ? '#171717' : '#454545',
      candidates: [{ x: p.x + 19, y: p.y - 18, align: 'left' }],
    });
  },
  draw() {
    this.queue.sort(
      (a, b) =>
        Number(this.dynamic(a.key)) - Number(this.dynamic(b.key)) ||
        Number(!!a.sparse) - Number(!!b.sparse) ||
        (b.level || 0) - (a.level || 0) ||
        (a.sparse && b.sparse
          ? Number(MapDetails.landmark(b.object)) - Number(MapDetails.landmark(a.object))
          : 0) ||
        (b.mass ?? -Infinity) - (a.mass ?? -Infinity) ||
        0 ||
        b.priority - a.priority ||
        a.key.localeCompare(b.key),
    );
    for (const q of this.queue) {
      if (q.sparse && !MapLandmarks.available(q.p, q.object)) continue;
      const mapName = q.object
        ? MapDetails.mapLabelName(q.object, q.object.kind === 'blackhole' && q.object.id === state.selected)
        : q.name;
      if (mapName === null) {
        if (q.sparse) q.onPlace?.();
        continue;
      }
      const name =
          q.object && mapName !== q.object.name
            ? /^(region|galaxy)-/.test(q.key)
              ? mapName.toUpperCase()
              : mapName
            : q.name,
        detail = typeof q.detail === 'function' ? q.detail() : q.detail,
        size = q.size || 9;
      const mainWidth = this.measure(name, size + 'px "Golos Text",Arial,sans-serif'),
        detailWidth = detail ? this.measure(detail, '7px "IBM Plex Mono",monospace') : 0;
      const candidates = q.key.startsWith('galaxy-') ? q.candidates.slice(0, 1) :
        q.object && globalThis.MapFilters?.promotes(q.object) && q.p
          ? [{x:q.p.x+12,y:q.p.y+25,align:'left'},
             {x:q.p.x-12,y:q.p.y+25,align:'right'},
             {x:q.p.x+12,y:q.p.y-12,align:'left'},
             {x:q.p.x-12,y:q.p.y-12,align:'right'}] : q.candidates;
      let placed = false;
      for (const caption of detail ? (q.object ? [detail, null] : [detail]) : [null]) {
        const w = Math.max(mainWidth, caption ? detailWidth : 0) + 12,
          h = caption ? 33 : 20;
        for (const p of candidates) {
          const x = p.align === 'right' ? p.x - w : p.align === 'center' ? p.x - w / 2 : p.x,
            box = { x: x - 4, y: p.y - size - 5, w: w + 8, h };
          if (
            !this.intersectsViewport(box) ||
            this.boxes.some((b) => this.overlaps(box, b)) ||
            (q.sparse && !MapLandmarks.labelClear(box, q.object))
          )
            continue;
          if (!this.dynamic(q.key)) this.slots.set(q.key, candidates.indexOf(p));
          this.boxes.push(box);
          this.placed.push({ key: q.key, ...box });
          const active = this.emphasized(q.object), alpha = active ? 1 : q.opacity ?? 1;
          ctx.save();
          ctx.globalAlpha = alpha;
          text(name, p.x, p.y, size, active ? '#171717' : q.color || '#646464', p.align || 'left', 'sans');
          if (caption) text(caption, p.x, p.y + 14, 7, active ? '#454545' : '#999999', p.align || 'left');
          ctx.restore();
          if (!q.sparse) q.onPlace?.(box);
          placed = true;
          break;
        }
        if (placed) break;
      }
      if (q.sparse) q.onPlace?.();
    }
  },
};

// Font metrics measured with the fallback face must never outlive font loading.
if (globalThis.document?.fonts) {
  document.fonts.ready.then(() => MapLabels.metrics.clear());
  document.fonts.addEventListener('loadingdone', () => MapLabels.metrics.clear());
}
