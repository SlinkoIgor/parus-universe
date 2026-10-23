/* Rounded reference values, not live measurements. See the sources in each card.
 * Galaxy optical extents are SIMBAD major/minor axes converted at the atlas distance.
 * They are NOT virial diameters. Diagram orientation is deliberately schematic. */
const Astro={
 solarLuminosity:3.828e26, solarMass:1.98847e30,
 simbad:name=>'https://simbad.cds.unistra.fr/simbad/sim-id?Ident='+encodeURIComponent(name),
 kmSource:'https://doi.org/10.1088/0004-637X/757/2/112',
 mSource:'https://doi.org/10.3847/1538-3881/acd1ec',
 galaxyExtent(distanceLy,arcmin){return 2*distanceLy*Math.tan(arcmin*Math.PI/21600);},
 visualLuminosity(distanceLy,v){const absoluteV=v-5*Math.log10(distanceLy/3.26156/10);return{absoluteV,solarV:10**(.4*(4.83-absoluteV))};}
};
const STAR_FACTS={
 sol:{class:'Жёлтый карлик · G2 V',mass:'1 M☉ · Солнце',lum:1,radius:'1 R☉ · 695 700 км',extra:['Земля','Масса 5,972·10²⁴ кг; радиус 6 371 км'],ref:'https://nssdc.gsfc.nasa.gov/planetary/factsheet/sunfact.html'},
 proxima:{class:'Вспыхивающий красный карлик · M5.5 Ve',mass:'≈ 0,12 M☉',lum:.00155,radius:'≈ 0,14 R☉',ref:Astro.kmSource},
 alpha:{class:'Двойная система · G2 V + K1 V',mass:'≈ 1,08 + 0,91 M☉ · A и B',lum:2.004,radius:'≈ 1,22 + 0,86 R☉ · A и B',note:'Светимость — сумма A и B; Проксима учитывается отдельной точкой.',ref:'https://doi.org/10.3847/1538-3881/abfaff'},
 barnard:{class:'Красный карлик · M4 V',mass:'≈ 0,15 M☉',lum:.00338,radius:'≈ 0,19 R☉',ref:Astro.kmSource},
 wolf:{class:'Вспыхивающий красный карлик · M6 V',mass:'≈ 0,09 M☉',lum:.001,radius:'≈ 0,15 R☉',note:'Вне вспышек; оценки светимости различаются примерно на 15%.',ref:'https://doi.org/10.1051/0004-6361/202453149'},
 lalande:{class:'Красный карлик · M2 V',mass:'≈ 0,40 M☉',lum:.01989,radius:'≈ 0,39 R☉',ref:Astro.kmSource},
 sirius:{class:'Двойная система · A1 V + белый карлик DA',mass:'≈ 2,06 + 1,02 M☉ · A и B',lum:25,radius:'≈ 1,71 + 0,008 R☉ · A и B',note:'Суммарная светимость; основной вклад даёт Сириус A.',ref:'https://files.ast.cam.ac.uk/pub/pub/rwa/outgoing/Downloads/sirius.pdf'},
 luyten:{class:'Двойная вспыхивающая система · M5.5 V + M6 V',mass:'≈ 0,12 + 0,12 M☉ · A и B',lum:.003,radius:'≈ 0,16 R☉ у каждой компоненты',note:'Приблизительная суммарная светимость вне вспышек.',ref:'https://arxiv.org/abs/1607.04351'},
 ross:{class:'Вспыхивающий красный карлик · M3.5 V',mass:'≈ 0,18 M☉',lum:.00389,radius:'≈ 0,21 R☉',ref:Astro.mSource},
 epsilon:{class:'Оранжевый карлик · K2 V',mass:'≈ 0,82 M☉',lum:.32,radius:'≈ 0,76 R☉',ref:'https://proteus-framework.org/PROTEUS/Reference/data.html'},
 tau:{class:'Жёлтый карлик · G8 V',mass:'≈ 0,78 M☉',lum:.49,radius:'≈ 0,79 R☉',ref:'https://doi.org/10.1051/0004-6361/201014886'},
 procyon:{class:'Двойная система · F5 IV–V + белый карлик',mass:'≈ 1,5 + 0,6 M☉ · A и B',lum:7.1,radius:'≈ 2,05 + 0,012 R☉ · A и B',note:'Светимость системы практически целиком задаёт Процион A.',ref:'https://arxiv.org/abs/astro-ph/0309148'},
 trappist:{class:'Ультрахолодный красный карлик · M8 V',mass:'≈ 0,090 M☉',lum:.00055,radius:'≈ 0,119 R☉',extra:['Планетная система','7 известных планет земного размера'],ref:'https://doi.org/10.3847/1538-4357/adf207'},
 vega:{class:'Быстро вращающаяся белая звезда · A0 V',mass:'≈ 2 M☉',lum:40,radius:'≈ 2,4–2,8 R☉ · полюс / экватор',note:'Округлённая оценка. Из-за вращения температура и поток зависят от широты; результаты моделей различаются.',ref:'https://orbi.uliege.be/handle/2268/19318'},
 polaris:{class:'Жёлтый сверхгигант, цефеида · F7 Ib',mass:'≈ 5,1 M☉ · компонент Aa',lum:2500,radius:'≈ 46 R☉ · Aa',extra:['Период пульсации','≈ 4 суток'],note:'Светимость округлена для цефеиды Aa и меняется при пульсации.',ref:'https://chara.gsu.edu/photos-videos/image-gallery/polaris'},
 betelgeuse:{class:'Красный сверхгигант · M1–M2 Ia–ab',mass:'≈ 15–20 M☉ · модельная оценка',lum:100000,radius:'≈ 700–1 000 R☉',note:'Переменная звезда. Масса, радиус и светимость существенно зависят от принятого расстояния и модели.',ref:'https://doi.org/10.3847/1538-4357/abb8db'}
};
// Optical angular axes (arcmin) and integrated photometry from CDS/SIMBAD.
const GALAXY_DATA=[
 ['lmc','LMC',322.827,274.770,.4,'irregular',-.25,'Магелланова галактика с перемычкой · SB(s)m','≈ 2,7·10⁹ M☉ · звёзды','https://doi.org/10.1017/pasa.2013.20'],
 ['smc','SMC',158.113,93.105,2.2,'irregular',.6,'Карликовая неправильная галактика · dIrr','≈ 5·10⁸ M☉ · звёзды','https://doi.org/10.3847/1538-4357/abc485'],
 ['andromeda','M31',199.53,70.79,3.44,'spiral',-.5,'Спиральная галактика · SA(s)b','≈ (1–1,5)·10¹¹ M☉ · звёзды','https://doi.org/10.1051/0004-6361/201220065'],
 ['triangulum','M33',60.26,35.48,5.72,'spiral',.25,'Спиральная галактика · SA(s)cd','≈ 4,8·10⁹ M☉ · звёзды','https://www.aanda.org/articles/aa/pdf/2014/12/aa24033-14.pdf'],
 ['centaurus','NGC5128',25.70,17.78,6.84,'elliptical',-.7,'Пекулярная эллиптическая / линзовидная радиогалактика','≈ 2·10¹¹ M☉ · звёзды','https://academic.oup.com/mnras/article/498/2/2766/5894402'],
 ['bode','M81',21.38,10.23,6.94,'spiral',.4,'Спиральная галактика · SA(s)ab','≈ 1,2·10¹² M☉ · динамическая, с гало','https://www.aanda.org/articles/aa/pdf/2024/03/aa48377-23.pdf'],
 ['sculptor','NGC253',28.84,5.89,null,'spiral',-.3,'Спиральная галактика со вспышкой звездообразования · SAB(s)c','≈ 3,5·10¹⁰ M☉ · звёзды','https://www.aanda.org/articles/aa/pdf/2023/08/aa46503-23.pdf'],
 ['whirlpool','M51',9.04379,7.78399,8.36,'spiral',.2,'Спиральная галактика с компаньоном · SA(s)bc','≈ 3·10¹⁰ M☉ · звёзды M51a','https://www.raa-journal.org/issues/all/2021/v21n1/202203/P020220324607428470809.pdf'],
 ['m87','M87',6.29875,5.7262,8.63,'elliptical',-.3,'Гигантская эллиптическая галактика · E','≈ 4·10¹¹ M☉ · звёзды','https://academic.oup.com/mnras/article/457/1/421/989033']
];
const GALAXIES=GALAXY_DATA.map(([id,ident,major,minor,v,shape,rotation,classification,mass,massSource])=>{
 const o=OBJECTS.find(o=>o.id===id),diameterLy=Astro.galaxyExtent(o.d,major);
 const geometry={id,name:o.name,x:o.x,y:o.y,diameterLy,axisRatio:minor/major,shape,rotation};
 o.galaxy=geometry;o.facts={class:classification,mass,visual:v===null?null:Astro.visualLuminosity(o.d,v),band:v===null?'B': 'V',lumUnknown:v===null?'Отдельная болометрическая оценка не приведена; галактика сильно запылена.':null,note:'Масса: '+(id==='bode'?'динамическая оценка включает тёмную материю.':'звёздная компонента, без газа и тёмной материи.')+' Размер — каталожный оптический контур, без внешнего слабого гало. Положение и поворот на 2D-карте схематичны.',refs:[[Astro.simbad(ident),'CDS / SIMBAD: оптический контур и фотометрия'],[massSource,'Оценка массы']]};
 return geometry;
});
// NGC 253 has B photometry in the cited catalog, not a V measurement.
const sculptor=OBJECTS.find(o=>o.id==='sculptor');
sculptor.facts.visual={absoluteV:8.03-5*Math.log10(sculptor.d/3.26156/10),solarV:10**(.4*(5.48-(8.03-5*Math.log10(sculptor.d/3.26156/10))))};
sculptor.facts.lumUnknown=null;
const EXTRA_FACTS={
 vela:{mass:'Не измерена напрямую; 1,4 M☉ — типичный ориентир, не измерение Вела',lumUnknown:'Единая болометрическая оценка не приведена; излучение сильно зависит от диапазона.',radius:'Порядка 10–15 км · модельный радиус',extra:['Вращение','≈ 11,2 оборота/с'],ref:'https://www.nasa.gov/missions/chandra/vela-pulsar/'},
 crab:{mass:'Не измерена напрямую; типичный ориентир нейтронной звезды — 1,4 M☉',lumUnknown:'Единая болометрическая оценка пульсара не приведена; её нельзя подменять светимостью всей туманности.',radius:'Порядка 10–15 км · модельный радиус',extra:['Вращение','≈ 30 оборотов/с'],ref:'https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-1/'},
 cygnus:{mass:'≈ 21,2 ± 2,2 M☉ · чёрная дыра',lumUnknown:'Собственное классическое излучение горизонта отсутствует; диск и джеты переменны.',radius:'≈ 63 км · радиус Шварцшильда для данной массы',extra:['Система','Чёрная дыра и голубой сверхгигант; период ≈ 5,6 суток'],ref:'https://doi.org/10.1126/science.abb3363'},
 sgr:{mass:'≈ 4,3·10⁶ M☉ · чёрная дыра',lumUnknown:'Горизонт сам не светит; излучает переменное аккреционное окружение.',radius:'≈ 12,7 млн км · радиус Шварцшильда',extra:['Галактика','Млечный Путь: оптический диск ≈ 100 000 св. лет'],ref:'https://www.eso.org/public/news/eso2208-eht-mw/'},
 orion:{mass:'Не приводится единым числом: M42 и весь молекулярный комплекс имеют разные границы',lumUnknown:'Единой болометрической оценки выбранной области в атласе нет.',radius:'≈ 24 св. года · яркая область M42',extra:['Объект','Область ионизованного водорода; звёзды Трапеции'],ref:'https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-42/'},
 omega:{mass:'≈ 4·10⁶ M☉ · звёздное скопление',visual:{absoluteV:-10.3,solarV:10**(.4*(4.83+10.3))},band:'V',radius:'≈ 150 св. лет · поперечник',extra:['Население','Миллионы звёзд разных поколений'],ref:'https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-caldwell-catalog/caldwell-80/'},
 virgo:{mass:'Оценка зависит от границ и метода; единой массы в атласе нет',lumUnknown:'Сумма излучения множества галактик и горячего газа; единое значение не задано.',extra:['Состав','Порядка 2 000 галактик'],ref:SOURCES.web},
 coma:{mass:'Порядка 10¹⁵ M☉ · динамическая оценка скопления',lumUnknown:'Излучение галактик и горячего газа; единого значения по всем диапазонам нет.',extra:['Состав','Тысячи галактик; значительная часть массы — тёмная материя'],ref:'https://chandra.harvard.edu/photo/2013/coma/'},
 attractor:{mass:'Не изолированное тело; оценка зависит от выделенной области',lumUnknown:'Не отдельный источник света; область концентрации галактик.',extra:['Наблюдаемый эффект','Влияет на пекулярные скорости галактик'],ref:SOURCES.web},
 laniakea:{mass:'Порядка 10¹⁷ M☉ · область космических потоков',lumUnknown:'Не единый источник; общая болометрическая светимость не определена.',radius:'≈ 520 млн св. лет · протяжённость',extra:['Статус','Сверхскопление, определённое по потокам галактик'],ref:'https://doi.org/10.1038/nature13674'},
 cfa:{mass:'Нет общепринятой единой оценки для выбранных границ',lumUnknown:'Не единый источник; интегральная светимость не определена.',radius:'≈ 500 млн св. лет · длина',extra:['Структура','Лист из галактик и скоплений'],ref:SOURCES.wall},
 bootes:{mass:'Разреженная область, не пустое пространство; суммарная масса не приведена',lumUnknown:'Светимость всей пустоты не определена; внутри есть отдельные галактики.',radius:'≈ 300 млн св. лет · диаметр',extra:['Структура','Космический войд · область пониженной плотности'],ref:SOURCES.wall},
 sloan:{mass:'Нет общепринятой суммарной оценки; границы зависят от определения',lumUnknown:'Не единый источник; общая светимость не определена.',radius:'≈ 1,4 млрд св. лет · длина',extra:['Связанность','Не является единым гравитационно связанным телом'],ref:SOURCES.wall},
 '3c273':{mass:'≈ 9·10⁸ M☉ · центральная чёрная дыра',lum:2.3e13,note:'Болометрическая изотропно-эквивалентная оценка ≈ 8,7·10³⁹ Вт, переменна. Релятивистский джет направлен почти к нам; это не поправленная на направленность мощность джета.',extra:['Красное смещение','z ≈ 0,158'],ref:'https://www.aanda.org/articles/aa/pdf/2015/03/aa25261-14.pdf'},
 ring:{mass:'Не установлена: кандидат в сверхструктуры',lumUnknown:'Не светящееся кольцо; структура выделена по поглощению Mg II.',radius:'≈ 1,3 млрд св. лет · диаметр',extra:['Достоверность','Интерпретация как единой структуры обсуждается'],ref:SOURCES.ring},
 arc:{mass:'Не установлена: кандидат в сверхструктуры',lumUnknown:'Не единый источник; структура выделена по поглощению Mg II.',radius:'≈ 3,3 млрд св. лет · длина',extra:['Достоверность','Статистическая интерпретация обсуждается'],ref:SOURCES.ring},
 horizon:{mass:'Неприменимо: горизонт — геометрическая граница, не тело',lumUnknown:'Собственного излучения нет; это граница доступной наблюдению области.',radius:'≈ 46,5 млрд св. лет · современный сопутствующий радиус',extra:['Размер области','≈ 93 млрд св. лет · диаметр'],ref:SOURCES.universe}
};
for(const o of OBJECTS){if(o.facts)continue;const f=STAR_FACTS[o.id]||EXTRA_FACTS[o.id];if(!f)throw new Error('Missing astronomical facts: '+o.id);o.facts={class:o.type,...f,refs:[[f.ref,'Характеристики и наблюдения']]};}
GALAXIES.unshift({...OBJECTS.find(o=>o.id==='sgr'),id:'milkyway',name:'Млечный Путь',diameterLy:100000,axisRatio:.55,shape:'spiral',rotation:-.5});
