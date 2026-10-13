/**
 * 业务建模 · 指标模块
 * - 创建指标：全局公共 / 特定域
 * - 公式依赖元数据字段
 * - 创建时设置默认业务日期（问数时间问法映射）
 * - 创建时可绑定分析维度（问数结果区可切换 GROUP BY）
 * - 绑定业务模型时校验公式字段 + 默认业务日期 + 分析维度是否齐全
 */
(function initMetricModule(global) {
  const STORAGE_KEY = "glodon.biz-metrics.v7";

  const CHART_STYLES = [
    { value: "bar", label: "柱状图" },
    { value: "line", label: "折线图" },
    { value: "hbar", label: "条形图" },
    { value: "area", label: "面积图" },
    { value: "donut", label: "环形图" },
    { value: "pie", label: "饼图" },
    { value: "kpi", label: "指标卡" },
  ];

  const DEFAULT_CHART_STYLE = "bar";

  const META_FIELDS = [
    { key: "recognized_amt", name: "确收金额", kind: "measure", fqn: "warehouse.dwd.dwd_revenue_detail.recognized_amt" },
    { key: "contract_amt", name: "合同额", kind: "measure", fqn: "warehouse.dwd.dwd_contract.contract_amt" },
    { key: "cost_amt", name: "成本金额", kind: "measure", fqn: "warehouse.dwd.dwd_cost_detail.cost_amt" },
    { key: "budget_amt", name: "预算金额", kind: "measure", fqn: "warehouse.dwd.dwd_cost_budget.budget_amt" },
    { key: "target_amt", name: "目标额", kind: "measure", fqn: "warehouse.dwd.dwd_contract.target_amt" },
    { key: "inbound_amt", name: "入库金额", kind: "measure", fqn: "warehouse.dwd.dwd_inbound.inbound_amt" },
    { key: "project_name", name: "项目名称", kind: "dimension", fqn: "warehouse.dwd.dwd_project.project_name" },
    { key: "biz_month", name: "统计月份", kind: "dimension", fqn: "warehouse.dwd.dwd_revenue_detail.biz_month", isBizDate: true },
    { key: "biz_date", name: "业务日期", kind: "date", fqn: "warehouse.dwd.dwd_revenue_detail.biz_date", isBizDate: true },
    { key: "sign_date", name: "签订日期", kind: "date", fqn: "warehouse.dwd.dwd_contract.sign_date", isBizDate: true },
    { key: "recognized_date", name: "确收日期", kind: "date", fqn: "warehouse.dwd.dwd_revenue_detail.recognized_date", isBizDate: true },
    { key: "cost_subject", name: "成本科目", kind: "dimension", fqn: "warehouse.dwd.dwd_cost_detail.cost_subject" },
    { key: "org_name", name: "组织名称", kind: "dimension", fqn: "warehouse.dim.org.org_name" },
  ];

  const DEFAULT_BIZ_DATE = { key: "biz_month", name: "统计月份" };

  const NAME_CODE_DICT = {
    合同额: "contract_amt",
    成本金额: "cost_amt",
    合同收入: "recognized_amt",
    确收金额: "recognized_amt",
    目标额: "target_amt",
    签约率: "sign_rate",
    预算金额: "budget_amt",
    入库金额: "inbound_amt",
    项目名称: "project_name",
    统计月份: "biz_month",
    业务日期: "biz_date",
    签订日期: "sign_date",
    确收日期: "recognized_date",
    成本科目: "cost_subject",
    组织名称: "org_name",
  };

  const PINYIN_INITIAL_GROUPS = {
    a: "啊阿埃挨哎唉哀皑癌蔼矮艾碍爱隘鞍氨安俺按暗岸胺案肮昂盎凹敖熬翱袄傲奥懊澳",
    b: "芭捌扒叭吧笆八疤巴拔跋靶把耙坝霸罢爸白柏百摆佰败拜稗斑班搬扳般颁板版扮拌伴瓣半办绊邦帮梆榜膀绑棒磅蚌镑傍谤苞胞包褒剥薄雹保堡饱宝抱报暴豹鲍爆杯碑悲卑北辈背贝钡倍狈备惫焙被奔苯本笨崩绷甭泵蹦迸逼鼻比鄙笔彼碧蓖蔽毕毙毖币庇痹闭敝弊必辟壁臂避陛鞭边编贬扁便变卞辨辩辫遍标彪膘表鳖憋别瘪彬斌濒滨宾摈兵冰柄丙秉饼炳病并玻菠播拨钵波博勃搏铂箔伯帛舶脖膊渤泊驳捕卜哺补埠不布步簿部怖",
    c: "擦猜裁材才财睬踩采彩菜蔡餐参蚕残惭惨灿苍舱仓沧藏操糙槽曹草厕策侧册测层蹭叉茬茶查碴搽察岔差诧拆柴豺搀掺蝉馋谗缠铲产阐颤昌猖场尝常长偿肠厂敞畅唱倡超抄钞朝嘲潮巢吵炒车扯撤掣彻澈郴臣辰尘晨忱沉陈趁衬撑称城橙成呈乘程惩澄诚承逞骋秤吃痴持匙池迟弛驰耻齿侈尺赤翅斥炽充冲虫崇宠抽酬畴踌稠愁筹仇绸瞅丑臭初出橱厨躇锄雏滁除楚础储矗搐触处揣川穿椽传船喘串疮窗床闯创吹炊捶锤垂春椿醇唇淳纯蠢戳绰疵茨磁雌辞慈瓷词此刺赐次聪葱囱匆从丛凑粗醋簇促蹿篡窜摧崔催脆瘁粹淬翠村存寸磋撮搓措挫错",
    d: "搭达答瘩打大呆歹傣戴带殆代贷袋待逮怠耽担丹单郸掸胆旦弹蛋当挡党荡档刀捣蹈倒岛祷导到稻悼道盗德得的蹬灯登等澄邓凳瞪磴低滴迪敌笛狄涤嫡抵底地蒂第帝弟递缔颠掂滇碘点典靛垫电佃甸店惦奠淀殿碉叼雕凋刁掉吊钓调跌爹碟蝶迭谍叠丁盯叮钉顶鼎锭定订丢东冬董懂动栋侗恫冻洞兜抖斗陡豆逗痘都督毒犊独读堵睹赌杜镀肚度渡妒端短锻段断缎堆兑队对墩吨蹲敦顿囤钝盾遁掇哆多夺垛躲朵跺舵剁惰堕",
    e: "蛾峨鹅俄额讹娥恶厄扼遏鄂饿恩而儿耳尔饵洱二贰",
    f: "发罚筏伐乏阀法珐藩帆番翻樊矾钒繁凡烦反返范贩犯饭泛坊芳方肪房防妨仿访纺放菲非啡飞肥匪诽吠肺废沸费芬酚吩氛分纷坟焚汾粉奋份忿愤粪丰封枫蜂峰锋风疯烽逢冯缝讽奉凤佛否夫敷肤孵扶拂辐幅氟符伏俘服浮涪福袱弗甫抚辅俯釜斧腑府腐赴副覆赋复傅付阜父腹负富讣附妇缚咐",
    g: "噶嘎该改概钙盖溉干甘杆柑竿肝赶感秆敢赣冈刚钢缸肛纲岗港杠篙皋高膏羔糕搞镐稿告哥歌搁戈鸽胳疙割革葛格蛤阁隔铬个各给根跟耕更庚羹埂耿梗工攻功恭龚供躬公宫弓巩汞拱贡共钩勾沟苟狗垢构购够辜菇咕箍估沽孤姑鼓古蛊骨谷股故顾固雇刮瓜剐寡挂褂乖拐怪棺关官冠观管馆罐惯灌贯光广逛瑰规圭硅归龟闺轨鬼诡癸桂柜跪贵刽辊滚棍锅郭国果裹过",
    h: "哈骸孩海氦亥害骇酣憨邯韩含涵寒函喊罕翰撼捍旱憾悍焊汗汉夯杭航壕嚎豪毫郝好耗号浩呵喝荷菏核禾和何合盒貉阂河涸赫褐鹤贺嘿黑痕很狠恨哼亨横衡恒轰哄烘虹鸿洪宏弘红喉侯猴吼厚候后呼乎忽瑚壶葫胡蝴狐糊湖弧虎唬护互沪户花哗华猾滑画划化话槐徊怀淮坏欢环桓还缓换患唤痪豢焕涣宦幻荒慌黄磺蝗簧皇凰惶煌晃幌恍谎灰挥辉徽恢蛔回毁悔慧卉惠晦贿秽会烩汇讳诲绘荤昏婚魂浑混豁活伙火获或惑霍货祸",
    j: "击圾基机畸稽积箕肌饥迹激讥鸡姬绩缉吉极棘辑籍集及急疾汲即嫉级挤几脊己蓟技冀季伎祭剂悸济寄寂计记既忌际妓继纪嘉枷夹佳家加荚颊贾甲钾假稼价架驾嫁歼监坚尖笺间煎兼肩艰奸缄茧检柬碱硷拣捡简俭剪减荐槛鉴践贱见键箭件健舰剑饯渐溅涧建僵姜将浆江疆蒋桨奖讲匠酱降蕉椒礁焦胶交郊浇骄娇嚼搅铰矫侥脚狡角饺缴绞剿教酵轿较叫窖揭接皆秸街阶截劫节桔杰捷睫竭洁结解姐戒藉芥界借介疥诫届巾筋斤金今津襟紧锦仅谨进靳晋禁近烬浸尽劲荆兢茎睛晶鲸京惊精粳经井警景颈静境敬镜径痉靖竟竞净炯窘揪究纠玖韭久灸九酒厩救旧臼舅咎就疚鞠拘狙疽居驹菊局咀矩举沮聚拒据巨具距踞锯俱句惧炬剧捐鹃娟倦眷卷绢撅攫抉掘倔爵桔觉决诀绝均菌钧军君峻俊竣浚郡骏",
    k: "喀咖卡咯开揩楷凯慨刊堪勘坎砍看康慷糠扛抗亢炕考拷烤靠坷苛柯棵磕颗科壳咳可渴克刻客课肯啃垦恳坑吭空恐孔控抠口扣寇枯哭窟苦酷库裤夸垮挎跨胯块筷侩快宽款匡筐狂框矿眶旷况亏盔岿窥葵奎魁傀馈愧溃坤昆捆困括扩廓阔",
    l: "垃拉喇蜡腊辣啦莱来赖蓝婪栏拦篮阑兰澜谰揽览懒缆烂滥琅榔狼廊郎朗浪捞劳牢老佬姥酪烙涝勒乐雷镭蕾磊累儡垒擂肋类泪棱楞冷厘梨犁黎篱狸离漓理李里鲤礼莉荔吏栗丽厉励砾历利傈例俐痢立粒沥隶力璃哩俩联莲连镰廉怜涟帘敛脸链恋炼练粮凉梁粱良两辆量晾亮谅撩聊僚疗燎寥辽潦了撂镣廖料列裂烈劣猎琳林磷霖临邻鳞淋凛赁吝拎玲菱零龄铃伶羚凌灵陵岭领另令溜琉榴硫馏留刘瘤流柳六龙聋咙笼窿隆垄拢陇楼娄搂篓漏陋芦卢颅庐炉掳卤虏鲁麓碌露路赂鹿潞禄录陆戮驴吕铝侣旅履屡缕虑氯律率滤绿峦挛孪滦卵乱掠略抡轮伦仑沦纶论萝螺罗逻锣箩骡裸落洛骆络",
    m: "妈麻玛码蚂马骂嘛吗埋买麦卖迈脉瞒馒蛮满蔓曼慢漫谩芒茫盲氓忙莽猫茅锚毛矛铆卯茂冒帽貌贸么玫枚梅酶霉煤没眉媒镁每美昧寐妹媚门闷们萌蒙檬盟锰猛梦孟眯醚靡糜迷谜弥米秘觅泌蜜密幂棉眠绵冕免勉娩缅面苗描瞄藐秒渺庙妙蔑灭民抿皿敏悯闽明螟鸣铭名命谬摸摹蘑模膜磨摩魔抹末莫墨默沫漠寞陌谋牟某拇牡亩姆母墓暮幕募慕木目睦牧穆",
    n: "拿哪呐钠那娜纳氖乃奶耐奈南男难囊挠脑恼闹淖呢馁内嫩能妮霓倪泥尼拟你匿腻逆溺蔫拈年碾撵捻念娘酿鸟尿捏聂孽啮镊镍涅您柠狞凝宁拧泞牛扭钮纽脓浓农弄奴努怒女暖虐疟挪懦糯诺",
    o: "哦欧鸥殴藕呕偶沤",
    p: "啪趴爬帕怕琶拍排牌徘湃派攀潘盘磐盼畔判叛乓庞旁耪胖抛咆刨炮袍跑泡呸胚培裴赔陪配佩沛喷盆砰抨烹澎彭蓬棚硼篷膨朋鹏捧碰坯砒霹批披劈琵毗啤脾疲皮匹痞僻屁譬篇偏片骗飘漂瓢票撇拼频贫品聘乒坪苹萍平凭瓶评屏坡泼颇婆破魄迫粕剖扑铺仆莆葡菩蒲埔朴圃普浦谱曝瀑",
    q: "期欺栖戚妻七凄漆柒沏其棋奇歧畦崎脐齐旗祈祁骑起岂乞企启契砌器气迄弃汽泣讫掐恰洽牵扦钎铅千迁签仟谦乾黔钱钳前潜遣浅谴堑嵌欠歉枪呛腔羌墙蔷强抢橇锹敲悄桥瞧乔侨巧鞘撬翘峭俏窍切茄且怯窃钦侵亲秦琴勤芹擒禽寝沁青轻氢倾卿清擎晴氰情顷请庆琼穷秋丘邱球求囚酋泅趋区蛆曲躯屈驱渠取娶龋趣去圈颧权醛泉全痊拳犬券劝缺炔瘸却鹊榷确雀裙群",
    r: "然燃冉染瓤壤攘嚷让饶扰绕惹热壬仁人忍韧任认刃妊纫扔仍日戎茸蓉荣融熔溶容绒冗揉柔肉茹蠕儒孺如辱乳汝入褥软阮蕊瑞锐闰润若弱",
    s: "撒洒萨腮鳃塞赛三叁伞散桑嗓丧搔骚扫嫂瑟色涩森僧莎砂杀刹沙纱傻啥煞筛晒珊苫杉山删煽衫闪陕擅赡膳善汕扇缮墒伤商赏晌上尚裳梢捎稍烧芍勺韶少哨邵绍奢赊蛇舌舍赦摄射慑涉社设砷申呻伸身深娠绅神沈审婶甚肾慎渗声生甥牲升绳省盛剩胜圣师失狮施湿诗尸虱十石拾时什食蚀实识史矢使屎驶始式示士世柿事拭誓逝势是嗜噬适仕侍释饰氏市恃室视试收手首守寿授售受瘦兽蔬枢梳殊抒输叔舒淑疏书赎孰熟薯暑曙署蜀黍鼠属术述树束戍竖墅庶数漱恕刷耍摔衰甩帅栓拴霜双爽谁水睡税吮瞬顺舜说硕朔烁斯撕嘶思私司丝死肆寺嗣四伺似饲巳松耸怂颂送宋讼诵搜艘擞嗽苏酥俗素速粟僳塑溯宿诉肃酸蒜算虽隋随绥髓碎岁穗遂隧祟孙损笋蓑梭唆缩琐索锁所",
    t: "塌他它她塔獭挞蹋踏胎苔抬台泰酞太态汰坍摊贪瘫滩坛檀痰潭谭谈坦毯袒碳探叹炭汤塘搪堂棠膛唐糖倘躺淌趟烫掏涛滔绦萄桃逃淘陶讨套特藤腾疼誊梯剔踢锑提题蹄啼体替嚏惕涕剃屉天添填田甜恬舔腆挑条迢眺跳贴铁帖厅听烃汀廷停亭庭挺艇通桐酮瞳同铜彤童桶捅筒统痛偷投头透凸秃突图徒途涂屠土吐兔湍团推颓腿蜕褪退吞屯臀拖托脱鸵陀驮驼椭妥拓唾",
    w: "挖哇蛙洼娃瓦袜歪外豌弯湾玩顽丸烷完碗挽晚皖惋宛婉万腕汪王亡枉网往旺望忘妄威巍微危韦违桅围唯惟为潍维苇萎委伟伪尾纬未蔚味畏胃喂魏位渭谓尉慰卫瘟温蚊文闻纹吻稳紊问嗡翁瓮挝蜗涡窝我斡卧握沃巫呜钨乌污诬屋无芜梧吾吴毋武五捂午舞伍侮坞戊雾晤物勿务悟误",
    x: "昔熙析西硒矽晰嘻吸锡牺稀息希悉膝夕惜熄烯溪汐犀檄袭席习媳喜铣洗系隙戏细瞎虾匣霞辖暇峡侠狭下厦夏吓掀锨先仙鲜纤咸贤舷闲涎弦嫌显险现献县腺馅羡宪陷限线相厢镶香箱襄湘乡翔祥详想响享项巷橡像向象萧硝霄削哮嚣销消宵淆晓小孝校肖啸笑效楔些歇蝎鞋协挟携邪斜胁谐写械卸蟹懈泄泻谢屑薪芯锌欣辛新忻心信衅星腥猩惺兴刑型形邢行醒幸杏性姓兄凶胸匈汹雄熊休修羞朽嗅锈秀袖绣墟戌需虚嘘须徐许蓄酗叙旭序畜恤絮婿绪续轩喧宣悬旋玄选癣眩绚靴薛学穴雪血勋熏循旬询寻驯巡殉汛训讯逊迅",
    y: "压押鸦鸭呀丫芽牙蚜崖衙涯雅哑亚讶焉咽阉烟淹盐严研蜒岩延言颜阎炎沿奄掩眼衍演艳堰燕厌砚雁唁彦焰宴谚验殃央鸯秧杨扬佯疡羊洋阳氧仰痒养样漾邀腰妖瑶摇尧遥窑谣姚咬舀药要耀椰噎耶爷野冶也页掖业叶曳腋夜液一壹医揖铱依伊衣颐夷遗移仪胰疑沂宜姨彝椅蚁倚已乙矣以艺抑易邑亿役臆逸肄疫亦裔意毅忆义益溢诣议谊译异翼翌绎茵荫因殷音阴姻吟银淫寅饮尹引隐印英樱婴鹰应缨莹萤营荧蝇迎赢盈影颖硬映哟拥佣臃痈庸雍踊蛹咏泳涌永恿勇用幽优悠忧尤由邮铀犹油游酉有友右佑釉诱又幼迂淤于盂榆虞愚舆余俞逾鱼愉渝渔隅予娱雨与屿禹宇语羽玉域芋郁吁遇喻峪御愈欲狱育誉浴寓裕预豫驭鸳渊冤元垣袁原援辕园员圆猿源缘远苑愿怨院曰约越跃钥岳粤月悦阅耘云郧匀陨允运蕴酝晕韵孕",
    z: "匝砸杂栽哉灾宰载再在咱攒暂赞赃脏葬遭糟凿藻枣早澡蚤躁噪造皂灶燥责择则泽贼怎增憎曾赠扎喳渣札轧铡闸眨栅榨咋乍炸诈摘斋宅窄债寨瞻毡詹粘沾盏斩辗崭展蘸栈占战站湛绽樟章彰漳张掌涨杖丈帐账仗胀瘴障招昭找沼赵照罩兆肇召遮哲蛰辙者锗蔗这浙珍斟真甄砧臻贞针侦枕疹诊震振镇阵蒸挣睁征狰争怔整拯正政帧症郑证芝枝支吱蜘知肢脂汁之织职直植殖执值侄址指止趾只旨纸志挚掷至致置帜峙制智秩稚质炙痔滞治窒中盅忠钟衷终种肿重仲众舟周州洲诌粥轴肘帚咒皱宙昼骤珠株蛛朱猪诸诛逐竹烛煮拄瞩嘱主著柱助蛀贮铸筑住注祝驻抓爪拽专砖转撰赚篆桩庄装妆撞壮状椎锥追赘坠缀谆准捉拙卓桌琢茁酌啄着灼浊兹咨资姿滋淄孜紫仔籽滓子自渍字鬃棕踪宗综总纵邹走奏揍租足卒族祖诅阻组钻纂嘴醉最罪尊遵昨左佐柞做作坐座",
  };

  const PINYIN_INITIAL_LOOKUP = (() => {
    const map = Object.create(null);
    Object.keys(PINYIN_INITIAL_GROUPS).forEach((initial) => {
      const chars = PINYIN_INITIAL_GROUPS[initial];
      for (let i = 0; i < chars.length; i += 1) map[chars[i]] = initial;
    });
    return map;
  })();

  function getCharPinyinInitial(char) {
    if (!char) return "";
    if (/[a-zA-Z]/.test(char)) return char.toLowerCase();
    if (/[0-9]/.test(char)) return char;
    return PINYIN_INITIAL_LOOKUP[char] || "";
  }

  function buildMetricEnglishCodeFromName(name) {
    const text = String(name || "").trim();
    if (!text) return "";
    if (NAME_CODE_DICT[text]) return NAME_CODE_DICT[text];
    const meta = META_FIELDS.find((f) => f.name === text);
    if (meta?.key) return meta.key;
    let code = "";
    for (const char of text) {
      if (/[\s\-_/·．.]/.test(char)) continue;
      const initial = getCharPinyinInitial(char);
      if (initial) code += initial;
    }
    code = code.replace(/[^a-z0-9_]/g, "").replace(/^_+|_+$/g, "");
    if (!code) code = `metric_${Date.now().toString(36).slice(-4)}`;
    if (/^[0-9]/.test(code)) code = `m_${code}`;
    return code.slice(0, 64);
  }

  const MODEL_CATALOG = [
    {
      id: "bm-contract-revenue",
      name: "合同收入确认模型",
      type: "域模型",
      domain: "收入管理",
      fieldNames: ["确收金额", "合同额", "目标额", "项目名称", "统计月份", "业务日期", "签订日期", "确收日期", "组织名称"],
    },
    {
      id: "bm-project-cost",
      name: "项目成本归集模型",
      type: "域模型",
      domain: "成本管理",
      fieldNames: ["成本金额", "预算金额", "项目名称", "成本科目", "统计月份", "业务日期"],
    },
    {
      id: "bm-material-purchase",
      name: "材料采购分析模型",
      type: "域模型",
      domain: "经营管理",
      fieldNames: ["入库金额", "项目名称", "物料名称", "组织名称", "业务日期", "统计月份"],
    },
    {
      id: "bm-subcontract",
      name: "分包结算口径模型",
      type: "域模型",
      domain: "成本管理",
      fieldNames: ["合同额", "成本金额", "项目名称", "统计月份", "业务日期"],
    },
    {
      id: "bm-safety",
      name: "安全隐患治理模型",
      type: "域模型",
      domain: "经营管理",
      fieldNames: ["项目名称", "组织名称", "统计月份", "业务日期"],
    },
    {
      id: "bm-supplier",
      name: "供应商对象",
      type: "基础模型",
      domain: "经营管理",
      fieldNames: ["供应商名称", "组织名称"],
    },
    {
      id: "bm-revenue-field-term-demo",
      name: "收入字段术语挂载模型",
      type: "基础模型",
      domain: "收入管理",
      fieldNames: ["组织名称", "合同额", "目标额", "订单金额", "签订日期", "工程名称"],
    },
  ];

  const MODEL_FIELD_MAP = MODEL_CATALOG.reduce((map, item) => {
    map[item.name] = item.fieldNames.slice();
    return map;
  }, {});

  function nowStamp() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }

  function uid(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function defaultMetrics() {
    return [
      {
        id: "metric-contract-amt",
        name: "合同额",
        code: "contract_amt",
        scope: "global",
        boardId: "",
        boardLabel: "全局公共",
        domain: "收入管理",
        caliber: "合同签订金额合计，不含作废合同。",
        formula: "SUM(col['contract_amt'])",
        kind: "atomic",
        fieldKeys: ["contract_amt"],
        fieldNames: ["合同额"],
        defaultBizDate: { key: "sign_date", name: "签订日期" },
        boundDimensions: [
          { key: "project_name", name: "项目名称" },
          { key: "org_name", name: "组织名称" },
          { key: "biz_month", name: "统计月份" },
        ],
        defaultDimensionKey: "org_name",
        chartStyle: "bar",
        status: "published",
        domainModels: [{ id: "bm-contract-revenue", name: "合同收入确认模型", type: "域模型" }],
        boundModelIds: ["bm-contract-revenue"],
        boundModelNames: ["合同收入确认模型"],
        creator: "李明",
        updatedAt: "2026-05-06 10:22:18",
      },
      {
        id: "metric-cost-amt",
        name: "成本金额",
        code: "cost_amt",
        scope: "domain",
        boardId: "pmlead",
        boardLabel: "PMLead产品",
        domain: "成本管理",
        caliber: "按权责归集；内部往来不计入。",
        formula: "SUM(col['cost_amt'])",
        kind: "atomic",
        fieldKeys: ["cost_amt"],
        fieldNames: ["成本金额"],
        defaultBizDate: { key: "biz_month", name: "统计月份" },
        boundDimensions: [
          { key: "project_name", name: "项目名称" },
          { key: "cost_subject", name: "成本科目" },
          { key: "biz_month", name: "统计月份" },
        ],
        defaultDimensionKey: "cost_subject",
        chartStyle: "hbar",
        status: "published",
        domainModels: [{ id: "bm-project-cost", name: "项目成本归集模型", type: "域模型" }],
        boundModelIds: ["bm-project-cost"],
        boundModelNames: ["项目成本归集模型"],
        creator: "王磊",
        updatedAt: "2026-05-05 16:41:09",
      },
      {
        id: "metric-revenue",
        name: "合同收入",
        code: "recognized_amt",
        scope: "domain",
        boardId: "pmlead",
        boardLabel: "PMLead产品",
        domain: "收入管理",
        caliber: "权责发生制确收，不含内部往来。",
        formula: "SUM(col['recognized_amt'])",
        kind: "atomic",
        fieldKeys: ["recognized_amt"],
        fieldNames: ["确收金额"],
        defaultBizDate: { key: "recognized_date", name: "确收日期" },
        boundDimensions: [
          { key: "project_name", name: "项目名称" },
          { key: "biz_month", name: "统计月份" },
        ],
        defaultDimensionKey: "project_name",
        chartStyle: "line",
        status: "draft",
        domainModels: [{ id: "bm-contract-revenue", name: "合同收入确认模型", type: "域模型" }],
        boundModelIds: [],
        boundModelNames: [],
        creator: "赵敏",
        updatedAt: "2026-05-04 09:18:33",
      },
      {
        id: "metric-target-amt",
        name: "目标额",
        code: "target_amt",
        kind: "atomic",
        scope: "domain",
        boardId: "pmlead",
        boardLabel: "PMLead产品",
        domain: "收入管理",
        caliber: "合同签约目标金额，按签订组织汇总。",
        formula: "SUM(col['target_amt'])",
        fieldKeys: ["target_amt"],
        fieldNames: ["目标额"],
        defaultBizDate: { key: "sign_date", name: "签订日期" },
        boundDimensions: [
          { key: "org_name", name: "组织名称" },
          { key: "biz_month", name: "统计月份" },
        ],
        defaultDimensionKey: "org_name",
        chartStyle: "bar",
        status: "published",
        domainModels: [{ id: "bm-contract-revenue", name: "合同收入确认模型", type: "域模型" }],
        boundModelIds: ["bm-contract-revenue"],
        boundModelNames: ["合同收入确认模型"],
        creator: "李明",
        updatedAt: "2026-05-06 10:22:18",
      },
      {
        id: "metric-sign-rate",
        name: "签约率",
        code: "sign_rate",
        kind: "derived",
        scope: "domain",
        boardId: "pmlead",
        boardLabel: "PMLead产品",
        domain: "收入管理",
        caliber: "签约率 = 合同额 / 目标额；分子分母同一业务时间口径。",
        formula: "metric['合同额'] / metric['目标额']",
        fieldKeys: ["contract_amt", "target_amt"],
        fieldNames: ["合同额", "目标额"],
        baseMetricNames: ["合同额", "目标额"],
        defaultBizDate: { key: "sign_date", name: "签订日期" },
        boundDimensions: [
          { key: "org_name", name: "组织名称" },
          { key: "biz_month", name: "统计月份" },
        ],
        defaultDimensionKey: "org_name",
        chartStyle: "kpi",
        status: "published",
        domainModels: [{ id: "bm-contract-revenue", name: "合同收入确认模型", type: "域模型" }],
        boundModelIds: ["bm-contract-revenue"],
        boundModelNames: ["合同收入确认模型"],
        creator: "李明",
        updatedAt: "2026-05-06 11:02:40",
      },
    ];
  }

  function resolveBizDate(value) {
    if (!value) return null;
    if (typeof value === "string") {
      const meta = META_FIELDS.find((f) => f.key === value || f.name === value);
      return meta
        ? { key: meta.key, name: meta.name }
        : { key: value, name: value };
    }
    const meta = META_FIELDS.find((f) => f.key === value.key || f.name === value.name);
    return {
      key: meta?.key || value.key || "",
      name: meta?.name || value.name || value.key || "",
    };
  }

  function getBizDateOptions() {
    return META_FIELDS.filter((f) => f.isBizDate || f.kind === "date");
  }

  function resolveChartStyle(value) {
    const hit = CHART_STYLES.find((c) => c.value === value);
    return hit ? hit.value : DEFAULT_CHART_STYLE;
  }

  function chartStyleLabel(value) {
    return CHART_STYLES.find((c) => c.value === value)?.label || "柱状图";
  }

  function normalizeMetric(metric) {
    const boundDimensions = (metric.boundDimensions || [])
      .map((d) => {
        if (!d) return null;
        if (typeof d === "string") {
          const meta = META_FIELDS.find((f) => f.key === d || f.name === d);
          return meta ? { key: meta.key, name: meta.name } : { key: d, name: d };
        }
        const meta = META_FIELDS.find((f) => f.key === d.key || f.name === d.name);
        return {
          key: meta?.key || d.key || d.name,
          name: meta?.name || d.name || d.key,
        };
      })
      .filter(Boolean);
    let defaultDimensionKey = metric.defaultDimensionKey || "";
    if (boundDimensions.length) {
      if (!boundDimensions.some((d) => d.key === defaultDimensionKey)) {
        defaultDimensionKey = boundDimensions[0].key;
      }
    } else {
      defaultDimensionKey = "";
    }
    const domains = Array.isArray(metric.domains) && metric.domains.length
      ? metric.domains.map((d) => String(d).trim()).filter(Boolean)
      : String(metric.domain || "")
          .split(/[、,，]/)
          .map((d) => d.trim())
          .filter(Boolean);
    return {
      ...metric,
      kind: metric.kind === "derived" ? "derived" : "atomic",
      defaultBizDate: resolveBizDate(metric.defaultBizDate),
      boundDimensions,
      defaultDimensionKey,
      chartStyle: resolveChartStyle(metric.chartStyle),
      domainModels: normalizeDomainModels(metric),
      domains,
      domain: domains.join("、"),
      online: metric.online !== false,
      termIds: Array.isArray(metric.termIds) ? metric.termIds.filter(Boolean) : [],
    };
  }

  function normalizeDomainModels(metric) {
    const fromField = Array.isArray(metric.domainModels) ? metric.domainModels : [];
    if (fromField.length) {
      return fromField
        .map((item) => {
          if (!item) return null;
          if (typeof item === "string") return { id: item, name: item, type: "域模型" };
          return {
            id: item.id || item.name,
            name: item.name || item.id,
            type: item.type || "域模型",
          };
        })
        .filter((item) => item?.name);
    }
    return (metric.boundModelNames || []).map((name, idx) => ({
      id: metric.boundModelIds?.[idx] || name,
      name,
      type: "域模型",
    }));
  }

  function readMetrics() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const seed = defaultMetrics();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
        return seed.map(normalizeMetric);
      }
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(normalizeMetric) : defaultMetrics();
    } catch (e) {
      return defaultMetrics();
    }
  }

  function writeMetrics(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    try {
      global.dispatchEvent(new CustomEvent("biz-metrics-updated", { detail: list }));
    } catch (e) {
      /* ignore */
    }
  }

  function parseFormulaFields(formula) {
    const text = String(formula || "");
    const keys = new Set();
    const names = new Set();
    const colRe = /col\[['\"]([^'\"]+)['\"]\]/g;
    let m;
    while ((m = colRe.exec(text))) {
      keys.add(m[1]);
      const meta = META_FIELDS.find((f) => f.key === m[1] || f.name === m[1]);
      if (meta) {
        keys.add(meta.key);
        names.add(meta.name);
      } else {
        names.add(m[1]);
      }
    }
    const metricRe = /metric\[['\"]([^'\"]+)['\"]\]/g;
    while ((m = metricRe.exec(text))) {
      names.add(m[1]);
      const meta = META_FIELDS.find((f) => f.key === m[1] || f.name === m[1]);
      if (meta) {
        keys.add(meta.key);
        names.add(meta.name);
      }
    }
    META_FIELDS.forEach((f) => {
      if (text.includes(f.name)) {
        keys.add(f.key);
        names.add(f.name);
      }
    });
    return { fieldKeys: [...keys], fieldNames: [...names] };
  }

  function getModelFields(modelName) {
    const mapped = MODEL_FIELD_MAP[modelName];
    if (mapped) return mapped.slice();
    const bridge = global.SemanticBridge?.readStore?.();
    const model = bridge?.models?.find((x) => x.name === modelName || x.id === modelName);
    if (!model) return [];
    const names = [];
    (model.datasets || []).forEach((ds) => {
      [...(ds.dimensions || []), ...(ds.measures || []), ...(ds.metrics || [])].forEach((f) => {
        names.push(f.name);
        (f.synonyms || []).forEach((s) => names.push(s));
      });
    });
    return [...new Set(names)];
  }

  function getBindableModels() {
    const fromBridge = (global.SemanticBridge?.getPublishedModels?.() || []).map((m) => ({
      id: m.id,
      name: m.name,
      type: m.type || (m.catalog === "base" ? "基础模型" : "域模型"),
      domain: m.domain || "",
    }));
    if (fromBridge.length) return fromBridge;
    return MODEL_CATALOG.map((item) => ({
      id: item.id,
      name: item.name,
      type: item.type,
      domain: item.domain,
    }));
  }

  function getAllBusinessModels() {
    const map = new Map();
    document.querySelectorAll("#listCatalogModelPanel tbody tr, #businessListBody tr").forEach((row) => {
      const link = row.querySelector(".name-link");
      const type = (link?.dataset.type || row.children[5]?.textContent || "").trim();
      if (type !== "域模型" && type !== "基础模型") return;
      const name = (link?.dataset.title || link?.textContent || "").trim();
      if (!name) return;
      const seed = MODEL_CATALOG.find((item) => item.name === name);
      map.set(name, {
        id: row.dataset.rowId || row.id || seed?.id || `model-${name}`,
        name,
        type,
        domain: row.dataset.domain || seed?.domain || "",
        fieldNames: seed?.fieldNames || MODEL_FIELD_MAP[name] || [],
      });
    });
    getBindableModels().forEach((model) => {
      if (!map.has(model.name)) {
        const seed = MODEL_CATALOG.find((item) => item.name === model.name);
        map.set(model.name, {
          ...model,
          fieldNames: seed?.fieldNames || MODEL_FIELD_MAP[model.name] || [],
        });
      }
    });
    MODEL_CATALOG.forEach((item) => {
      if (!map.has(item.name)) map.set(item.name, { ...item });
    });
    return [...map.values()];
  }

  function resolveFieldMeta(fieldName) {
    return META_FIELDS.find((f) => f.name === fieldName || f.key === fieldName) || null;
  }

  function fieldsOfModels(modelNames = []) {
    const names = new Set();
    (modelNames || []).forEach((modelName) => {
      getModelFields(modelName).forEach((name) => names.add(name));
    });
    return [...names].map((name) => {
      const meta = resolveFieldMeta(name);
      return {
        key: meta?.key || name,
        name: meta?.name || name,
        kind: meta?.kind || "dimension",
        fqn: meta?.fqn || "",
      };
    });
  }

  function getMetricRequiredFieldNames(metric) {
    const formulaNames = metric.fieldNames?.length
      ? metric.fieldNames.slice()
      : parseFormulaFields(metric.formula).fieldNames;
    const dimNames = (metric.boundDimensions || []).map((d) => d.name || d.key).filter(Boolean);
    const bizDateName = metric.defaultBizDate?.name || metric.defaultBizDate?.key;
    return [...new Set([...formulaNames, ...dimNames, ...(bizDateName ? [bizDateName] : [])])];
  }

  function upsertAtomicFromDict(items) {
    let list = readMetrics();
    (items || []).forEach((item) => {
      if (!item?.name) return;
      const parsed = parseFormulaFields(item.formula || `SUM(col['${item.code || item.name}'])`);
      const payload = normalizeMetric({
        id: item.id || `metric-dict-${item.code || item.name}`,
        name: item.name,
        code: item.code || item.name,
        kind: "atomic",
        scope: item.scope || "domain",
        boardId: item.boardId || "pmlead",
        boardLabel: item.boardLabel || "PMLead产品",
        domain: item.domain || "收入管理",
        caliber: item.caliber || `${item.name}由字段设置字典半自动生成。`,
        formula: item.formula || `SUM(col['${item.code || item.name}'])`,
        fieldKeys: parsed.fieldKeys,
        fieldNames: parsed.fieldNames.length ? parsed.fieldNames : [item.name],
        defaultBizDate: resolveBizDate(item.defaultBizDate || DEFAULT_BIZ_DATE),
        boundDimensions: item.boundDimensions || [],
        defaultDimensionKey: item.defaultDimensionKey || (item.boundDimensions?.[0]?.key || ""),
        chartStyle: resolveChartStyle(item.chartStyle || DEFAULT_CHART_STYLE),
        domainModels: item.domainModels || [{ id: "bm-contract-revenue", name: "合同收入确认模型", type: "域模型" }],
        status: "published",
        online: true,
        domainModels: [{ id: "bm-contract-revenue", name: "合同收入确认模型", type: "域模型" }],
        boundModelIds: ["bm-contract-revenue"],
        boundModelNames: ["合同收入确认模型"],
        creator: "当前用户",
        updatedAt: nowStamp(),
      });
      const idx = list.findIndex((m) => m.id === payload.id || m.code === payload.code || m.name === payload.name);
      if (idx >= 0) {
        payload.id = list[idx].id;
        payload.boundModelIds = list[idx].boundModelIds?.length ? list[idx].boundModelIds : payload.boundModelIds;
        payload.boundModelNames = list[idx].boundModelNames?.length ? list[idx].boundModelNames : payload.boundModelNames;
        payload.online = list[idx].online !== false;
        list[idx] = { ...list[idx], ...payload };
      } else {
        list = [payload, ...list];
      }
      syncMetricToSemanticBridge(payload);
    });
    writeMetrics(list);
    return list;
  }

  function validateMetricAgainstModel(metric, modelName) {
    const modelFields = getModelFields(modelName);
    const required = getMetricRequiredFieldNames(metric);
    const missing = required.filter((name) => {
      const meta = META_FIELDS.find((f) => f.name === name || f.key === name);
      const aliases = meta ? [meta.name, meta.key] : [name];
      return !aliases.some((a) => modelFields.includes(a));
    });
    return { ok: missing.length === 0, missing, modelFields, required };
  }

  function syncMetricToSemanticBridge(metric) {
    if (!global.SemanticBridge || metric.status !== "published" || metric.online === false) return;
    const store = global.SemanticBridge.ensureSeed();
    (metric.boundModelNames || []).forEach((modelName) => {
      const model = store.models.find((m) => m.name === modelName);
      if (!model || !model.datasets?.[0]) return;
      const ds = model.datasets[0];
      ds.metrics = ds.metrics || [];
      const idx = ds.metrics.findIndex((x) => x.name === metric.name || x.code === metric.code);
      const payload = {
        name: metric.name,
        code: metric.code,
        dataType: "number",
        synonyms: [metric.code, metric.name],
        description: metric.caliber,
        formula: metric.formula,
        businessCaliber: metric.caliber,
        fqn: META_FIELDS.find((f) => metric.fieldKeys?.includes(f.key))?.fqn || "",
        scope: metric.scope,
        kind: metric.kind === "derived" ? "derived" : "atomic",
        defaultBizDate: metric.defaultBizDate || null,
        defaultDimensionKey: metric.defaultDimensionKey || "",
        chartStyle: metric.chartStyle || DEFAULT_CHART_STYLE,
        domainModels: metric.domainModels || [],
        boundDimensions: (metric.boundDimensions || []).map((d) => ({
          key: d.key,
          name: d.name,
        })),
        online: true,
      };
      if (idx >= 0) ds.metrics[idx] = { ...ds.metrics[idx], ...payload };
      else ds.metrics.push(payload);
      global.SemanticBridge.upsertModel(model);
    });
  }

  function removeMetricFromSemanticBridge(metric) {
    if (!global.SemanticBridge || !metric) return;
    const store = global.SemanticBridge.ensureSeed();
    (store.models || []).forEach((model) => {
      let modelChanged = false;
      (model.datasets || []).forEach((ds) => {
        if (!Array.isArray(ds.metrics)) return;
        const before = ds.metrics.length;
        ds.metrics = ds.metrics.filter((x) => x.name !== metric.name && x.code !== metric.code);
        if (ds.metrics.length !== before) modelChanged = true;
      });
      if (modelChanged) global.SemanticBridge.upsertModel(model);
    });
  }

  function mount(api) {
    const {
      setTip,
      escapeHtml,
      getBoardNodes,
      getDomainNodesForBoard,
      collectUniqueDomainLabels,
      getCurrentProject,
    } = api;

    let metrics = readMetrics();
    let editingId = null;
    let bindingMetricId = null;
    let selectedModelKeys = new Set();
    let sqlSuggestIndex = -1;
    let domainFilter = "";
    let selectedTermIds = new Set();
    let mountTarget = null; // { type: 'metric'|'field', ids: [] }
    let metricCodeAutoValue = "";
    let metricCodeManualEdited = false;

    const modelPanelEl = document.getElementById("listCatalogModelPanel");
    const metricPanelEl = document.getElementById("listCatalogMetricPanel");
    const modelActionsEl = document.getElementById("listCatalogModelActions");
    const metricActionsEl = document.getElementById("listCatalogMetricActions");
    const metricTbodyEl = document.getElementById("metricTableBody");
    const metricSearchEl = document.getElementById("metricSearchInput");
    const createBtnEl = document.getElementById("createMetricBtn");
    const batchTermBtnEl = document.getElementById("metricBatchTermBtn");
    const modalEl = document.getElementById("metricEditView");
    const listViewEl = document.getElementById("listView");
    const modelViewEl = document.getElementById("modelView");
    const formEl = document.getElementById("metricCreateForm");
    const bindDrawerEl = document.getElementById("metricBindDrawer");
    const bindBodyEl = document.getElementById("metricBindDrawerBody");
    const mountDrawerEl = document.getElementById("termMountDrawer");
    const mountTitleEl = document.getElementById("termMountDrawerTitle");
    const mountListEl = document.getElementById("termMountList");
    const mountSearchEl = document.getElementById("termMountSearch");
    const mountBindBtnEl = document.getElementById("termMountBindBtn");
    const mountUnbindBtnEl = document.getElementById("termMountUnbindBtn");
    const mountCloseBtnEl = document.getElementById("closeTermMountDrawerBtn");
    const mountCancelBtnEl = document.getElementById("termMountCancelBtn");

    function currentProject() {
      return (typeof getCurrentProject === "function" && getCurrentProject()) || "pmlead-市场指标";
    }

    function getMountableTerms() {
      return (global.TermModule?.readOnlineTerms?.(currentProject()) || []).slice();
    }

    function getAllTerms() {
      return (global.TermModule?.readTerms?.() || global.BizTermUI?.readTerms?.() || []).slice();
    }

    function termById(id) {
      return getAllTerms().find((t) => t.id === id) || null;
    }

    function recommendTerms(metricName) {
      const name = String(metricName || "").trim().toLowerCase();
      if (!name) return [];
      return getMountableTerms()
        .filter((term) => termFitsContext(term, metricTermContext()))
        .map((t) => {
          const aliases = [t.name, ...(String(t.synonyms || "").split(/[,，]/).map((s) => s.trim()))]
            .filter(Boolean)
            .map((s) => s.toLowerCase());
          let score = 0;
          aliases.forEach((a) => {
            if (a === name) score = Math.max(score, 100);
            else if (name.includes(a) || a.includes(name)) score = Math.max(score, 70);
            else if (name.slice(0, 2) && a.startsWith(name.slice(0, 2))) score = Math.max(score, 40);
          });
          return { term: t, score };
        })
        .filter((x) => x.score >= 40)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
    }

    function renderSelectedTermTags() {
      const tagsEl = document.getElementById("metricTermTags");
      if (!tagsEl) return;
      const ids = [...selectedTermIds];
      if (!ids.length) {
        tagsEl.innerHTML = "";
        return;
      }
      tagsEl.innerHTML = ids
        .map((id) => {
          const t = termById(id);
          const label = t?.name || id;
          return `<span class="metric-term-tag" data-term-id="${escapeHtml(id)}">${escapeHtml(label)}<button type="button" data-remove-term="${escapeHtml(id)}" aria-label="移除">×</button></span>`;
        })
        .join("");
    }

    function metricTermContext() {
      const models = getAllBusinessModels().filter((model) => selectedModelKeys.has(model.name));
      return {
        modelNames: models.map((model) => model.name),
        domains: [...new Set(models.map((model) => model.domain).filter(Boolean))],
      };
    }

    function metricDomainList(metric) {
      if (!metric) return [];
      const direct = Array.isArray(metric.domains) && metric.domains.length
        ? metric.domains.map((d) => String(d).trim()).filter(Boolean)
        : String(metric.domain || "")
            .split(/[、,，]/)
            .map((name) => name.trim())
            .filter(Boolean);
      if (direct.length) return direct;
      const catalog = getAllBusinessModels();
      const modelNames = [
        ...(metric.boundModelNames || []),
        ...((metric.domainModels || []).map((item) => item.name)),
      ];
      return [
        ...new Set(
          modelNames
            .map((name) => catalog.find((model) => model.name === name)?.domain)
            .filter(Boolean)
        ),
      ];
    }

    function termInDomains(term, domains) {
      const domainList = (domains || []).map((d) => String(d).trim()).filter(Boolean);
      if (!domainList.length) return true;
      const termDomains = Array.isArray(term?.domains) && term.domains.length
        ? term.domains.map((d) => String(d).trim()).filter(Boolean)
        : String(term?.domain || "")
            .split(/[、,，]/)
            .map((name) => name.trim())
            .filter(Boolean);
      return domainList.some((domain) => termDomains.includes(domain));
    }

    function termFitsContext(term, context) {
      const applies = global.TermModule?.termAppliesToModels;
      if (typeof applies !== "function") return true;
      return applies(term, context || {});
    }

    function termFitsMountTarget(term, target) {
      if (!target) return false;
      if (target.type === "metric") {
        return termInDomains(term, target.domains || []);
      }
      return termFitsContext(term, {
        modelNames: target.modelNames || [],
        domains: target.domains || [],
      });
    }

    function renderTermSuggest(keyword = "") {
      const suggestEl = document.getElementById("metricTermSuggest");
      if (!suggestEl) return;
      const q = keyword.trim().toLowerCase();
      const online = getMountableTerms();
      const offline = (global.TermModule?.readTerms?.() || [])
        .filter((t) => (!t.project || t.project === currentProject()) && t.online === false);
      const context = metricTermContext();
      const pool = [
        ...online.map((t) => ({ ...t, disabled: false })),
        ...offline.map((t) => ({ ...t, disabled: true })),
      ].filter((t) => termFitsContext(t, context)).filter((t) => {
        if (!q) return true;
        return [t.name, t.synonyms, t.domain].join(" ").toLowerCase().includes(q);
      }).slice(0, 20);
      if (!pool.length) {
        suggestEl.hidden = true;
        suggestEl.innerHTML = "";
        return;
      }
      suggestEl.hidden = false;
      suggestEl.innerHTML = pool
        .map((t) => {
          const checked = selectedTermIds.has(t.id);
          const tip = t.disabled ? "未上线，不可挂载" : "";
          return `<label class="metric-term-option ${t.disabled ? "is-disabled" : ""}" title="${escapeHtml(tip)}">
            <input type="checkbox" data-term-pick="${escapeHtml(t.id)}" ${checked ? "checked" : ""} ${t.disabled ? "disabled" : ""} />
            <span><strong>${escapeHtml(t.name)}</strong> · ${escapeHtml(t.domain || "")}${t.disabled ? "（未上线）" : ""}<br/><span style="color:#98a2b3">${escapeHtml(t.synonyms || "无同义词")}</span></span>
          </label>`;
        })
        .join("");
    }

    function renderTermRecommend(metricName) {
      const box = document.getElementById("metricTermRecommend");
      if (!box) return;
      const recs = recommendTerms(metricName);
      if (!recs.length) {
        box.hidden = true;
        box.innerHTML = "";
        return;
      }
      box.hidden = false;
      box.innerHTML = `推荐术语（请确认后勾选）：${recs
        .map(
          ({ term }) =>
            `<label style="margin-right:10px;"><input type="checkbox" data-term-pick="${escapeHtml(term.id)}" ${selectedTermIds.has(term.id) ? "checked" : ""} /> ${escapeHtml(term.name)}</label>`
        )
        .join("")}`;
    }

    function dataDomainLabel(metric) {
      if (Array.isArray(metric?.domains) && metric.domains.length) {
        return metric.domains.join("、");
      }
      return metric?.domain || "—";
    }

    function scopeLabel(metric) {
      const names = (metric.domainModels || []).map((d) => d.name).filter(Boolean);
      if (names.length) return names.join("、");
      if (metric.scope === "global") return "全局公共";
      return "未选择域";
    }

    function statusLabel(status) {
      return status === "published" ? "已发布" : "草稿";
    }

    function dimLabel(metric) {
      const dims = metric.boundDimensions || [];
      if (!dims.length) return "未绑定";
      return dims
        .map((d) => {
          const name = d.name || d.key;
          return d.key === metric.defaultDimensionKey ? `${name}(默认)` : name;
        })
        .join("、");
    }

    function bizDateLabel(metric) {
      const d = metric.defaultBizDate;
      return d?.name || d?.key || "未设置";
    }

    function fillBizDateSelect(selectedKey) {
      const select = document.getElementById("metricDefaultBizDateSelect");
      if (!select) return;
      const options = getBizDateOptions();
      const current = selectedKey || "";
      select.innerHTML = [
        '<option value="">请选择默认业务日期字段</option>',
        ...options.map((f) =>
          `<option value="${escapeHtml(f.key)}" ${f.key === current ? "selected" : ""}>${escapeHtml(f.name)}（${escapeHtml(f.key)}）</option>`
        ),
      ].join("");
    }

    function readDefaultBizDateFromForm() {
      const select = document.getElementById("metricDefaultBizDateSelect");
      const key = select?.value || "";
      if (!key) return null;
      return resolveBizDate(key);
    }

    function setChartStyleForm(value) {
      const style = resolveChartStyle(value);
      document.querySelectorAll('input[name="metricChartStyle"]').forEach((input) => {
        input.checked = input.value === style;
        input.closest(".metric-chart-chip")?.classList.toggle("is-checked", input.checked);
      });
    }

    function readChartStyleFromForm() {
      const checked = document.querySelector('input[name="metricChartStyle"]:checked');
      return resolveChartStyle(checked?.value);
    }

    function bindChartStyleEvents() {
      document.querySelectorAll('input[name="metricChartStyle"]').forEach((input) => {
        input.addEventListener("change", () => {
          document.querySelectorAll(".metric-chart-chip").forEach((chip) => {
            const radio = chip.querySelector('input[name="metricChartStyle"]');
            chip.classList.toggle("is-checked", Boolean(radio?.checked));
          });
        });
      });
    }

    function syncDimDefaultState(preferredKey) {
      const checked = [...document.querySelectorAll('input[name="metricBoundDim"]:checked')];
      const radios = [...document.querySelectorAll('input[name="metricDefaultDim"]')];
      radios.forEach((radio) => {
        const enabled = checked.some((c) => c.value === radio.value);
        radio.disabled = !enabled;
        if (!enabled) radio.checked = false;
      });
      let defaultRadio = radios.find((r) => !r.disabled && r.value === preferredKey && preferredKey);
      if (!defaultRadio) defaultRadio = radios.find((r) => r.checked && !r.disabled);
      if (!defaultRadio) defaultRadio = radios.find((r) => !r.disabled);
      if (defaultRadio) defaultRadio.checked = true;
      document.querySelectorAll(".metric-dim-chip").forEach((chip) => {
        const cb = chip.querySelector('input[name="metricBoundDim"]');
        const radio = chip.querySelector('input[name="metricDefaultDim"]');
        chip.classList.toggle("is-checked", Boolean(cb?.checked));
        chip.classList.toggle("is-default", Boolean(radio?.checked && cb?.checked));
      });
    }

    function renderBoundDimensionOptions(selectedKeys = [], defaultKey = "") {
      const wrap = document.getElementById("metricBoundDimOptions");
      if (!wrap) return;
      const dims = META_FIELDS.filter((f) => f.kind === "dimension");
      const selected = new Set(selectedKeys);
      const preferred = defaultKey && selected.has(defaultKey)
        ? defaultKey
        : (selectedKeys[0] || "");
      wrap.innerHTML = dims
        .map((f) => `
          <div class="metric-dim-chip ${selected.has(f.key) ? "is-checked" : ""} ${preferred === f.key ? "is-default" : ""}">
            <label class="metric-dim-chip-main">
              <input type="checkbox" name="metricBoundDim" value="${escapeHtml(f.key)}" ${selected.has(f.key) ? "checked" : ""} />
              <span class="metric-dim-chip-name">${escapeHtml(f.name)}</span>
              <span class="metric-dim-chip-en">${escapeHtml(f.key)}</span>
            </label>
            <label class="metric-dim-default-radio">
              <input type="radio" name="metricDefaultDim" value="${escapeHtml(f.key)}" ${preferred === f.key ? "checked" : ""} ${selected.has(f.key) ? "" : "disabled"} />
              默认
            </label>
          </div>
        `)
        .join("");
      wrap.querySelectorAll('input[name="metricBoundDim"]').forEach((input) => {
        input.addEventListener("change", () => {
          syncDimDefaultState(document.querySelector('input[name="metricDefaultDim"]:checked')?.value || "");
        });
      });
      wrap.querySelectorAll('input[name="metricDefaultDim"]').forEach((input) => {
        input.addEventListener("change", () => {
          if (!input.checked) return;
          const cb = document.querySelector(`input[name="metricBoundDim"][value="${CSS.escape(input.value)}"]`);
          if (cb && !cb.checked) {
            cb.checked = true;
          }
          syncDimDefaultState(input.value);
        });
      });
      syncDimDefaultState(preferred);
    }

    function readBoundDimensionsFromForm() {
      return [...document.querySelectorAll('input[name="metricBoundDim"]:checked')]
        .map((input) => {
          const meta = META_FIELDS.find((f) => f.key === input.value);
          return meta ? { key: meta.key, name: meta.name } : null;
        })
        .filter(Boolean);
    }

    function readDefaultDimensionKeyFromForm(boundDimensions) {
      const checkedDefault = document.querySelector('input[name="metricDefaultDim"]:checked');
      if (checkedDefault && boundDimensions.some((d) => d.key === checkedDefault.value)) {
        return checkedDefault.value;
      }
      return boundDimensions[0]?.key || "";
    }

    function setPickerOpen(triggerId, dropdownId, open) {
      const trigger = document.getElementById(triggerId);
      const dropdown = document.getElementById(dropdownId);
      if (!trigger || !dropdown) return;
      trigger.classList.toggle("is-open", open);
      dropdown.hidden = !open;
    }

    function setModelPickerOpen(open) {
      setPickerOpen("metricModelTrigger", "metricModelDropdown", open);
    }

    function modelDomainOf(model) {
      if (!model) return "";
      const seed = MODEL_CATALOG.find((item) => item.name === model.name);
      return model.domain || seed?.domain || "";
    }

    function renderModelTags() {
      const tagsEl = document.getElementById("metricModelTags");
      if (!tagsEl) return;
      const models = getAllBusinessModels().filter((m) => selectedModelKeys.has(m.name));
      tagsEl.innerHTML = models
        .map((model) => {
          const domain = modelDomainOf(model);
          const title = domain ? `${model.name} · ${domain}` : model.name;
          return `
          <span class="metric-domain-tag" data-name="${escapeHtml(model.name)}">
            <span title="${escapeHtml(title)}">${escapeHtml(model.name)}</span>
            <button type="button" data-remove-model="${escapeHtml(model.name)}" aria-label="移除 ${escapeHtml(model.name)}">×</button>
          </span>
        `;
        })
        .join("");
    }

    function renderModelDropdown(keyword = "") {
      const listEl = document.getElementById("metricModelList");
      if (!listEl) return;
      const q = keyword.trim().toLowerCase();
      const models = getAllBusinessModels().filter((model) => {
        if (!q) return true;
        const domain = modelDomainOf(model);
        return [model.name, model.type, domain].join(" ").toLowerCase().includes(q);
      });
      if (!models.length) {
        listEl.innerHTML = `<div class="metric-domain-empty">没有匹配的模型</div>`;
        return;
      }
      listEl.innerHTML = models
        .map((model) => {
          const checked = selectedModelKeys.has(model.name);
          const domain = modelDomainOf(model);
          return `
            <label class="metric-domain-item ${checked ? "is-checked" : ""}">
              <input type="checkbox" name="metricBoundModelPick" value="${escapeHtml(model.name)}" ${checked ? "checked" : ""} />
              <span>${escapeHtml(model.name)}</span>
              <span class="metric-domain-item-type">${escapeHtml(domain || model.type || "模型")}</span>
            </label>
          `;
        })
        .join("");
    }

    const CALC_FORMULA_PLACEHOLDER = "请输入计算逻辑，如 SUM(col['contract_amt'])";
    const CALC_FORMULA_LOCKED_PLACEHOLDER = "请先在左侧选择模型，再编写计算公式";
    const CALC_SQL_PLACEHOLDER = "SELECT SUM(contract_amt) AS metric_value\nFROM contract_fact\nWHERE status <> '作废'";
    const CALC_SQL_LOCKED_PLACEHOLDER = "请先在左侧选择模型，再编写 SQL";

    function hasSelectedCalcModels() {
      return selectedModelKeys.size > 0;
    }

    function promptSelectModelForCalc() {
      setTip("请先选择模型");
      setModelPickerOpen(true);
      document.getElementById("metricModelSearch")?.focus();
    }

    function requireSelectedModelsForCalc() {
      if (hasSelectedCalcModels()) return true;
      promptSelectModelForCalc();
      return false;
    }

    function syncCalcLogicAvailability() {
      const locked = !hasSelectedCalcModels();
      const calcCol = document.getElementById("metricCalcColumn");
      calcCol?.classList.toggle("is-calc-locked", locked);
      const banner = document.getElementById("metricCalcLockBanner");
      if (banner) banner.hidden = !locked;

      const formulaEl = document.getElementById("metricFormulaInput");
      const sqlEl = document.getElementById("metricSqlInput");
      if (formulaEl) {
        formulaEl.readOnly = locked;
        formulaEl.placeholder = locked ? CALC_FORMULA_LOCKED_PLACEHOLDER : CALC_FORMULA_PLACEHOLDER;
      }
      if (sqlEl) {
        sqlEl.readOnly = locked;
        sqlEl.placeholder = locked ? CALC_SQL_LOCKED_PLACEHOLDER : CALC_SQL_PLACEHOLDER;
      }

      document.querySelectorAll("#metricCalcOpsBar .indicator-calc-op-btn").forEach((btn) => {
        btn.disabled = locked;
      });
      document.querySelectorAll(".indicator-calc-data-search").forEach((el) => {
        el.disabled = locked;
      });

      const aiInput = document.getElementById("metricAiChatInput");
      if (aiInput) {
        aiInput.readOnly = locked;
        if (locked) {
          aiInput.placeholder = "请先选择模型后再使用 AI 生成";
        } else {
          updateMetricAiDrawerHint();
        }
      }

      if (locked) {
        setMetricAiDrawerOpen(false);
        hideSqlSuggest();
        hideCalcResult();
      }
    }

    function refreshModelPickerUi() {
      renderModelTags();
      renderModelDropdown(document.getElementById("metricModelSearch")?.value || "");
      renderCalcDataTree();
      hideSqlSuggest();
      syncCalcLogicAvailability();
    }

    function initModelPicker(selectedModels = []) {
      selectedModelKeys = new Set(
        (selectedModels || []).map((item) => item?.name || item).filter(Boolean)
      );
      const modelSearch = document.getElementById("metricModelSearch");
      if (modelSearch) modelSearch.value = "";
      refreshModelPickerUi();
      setModelPickerOpen(false);
    }

    function readSelectedModelsFromForm() {
      const all = getAllBusinessModels();
      return [...selectedModelKeys]
        .map((name) => all.find((m) => m.name === name))
        .filter(Boolean)
        .map((model) => ({
          id: model.id || model.name,
          name: model.name,
          type: model.type || "域模型",
          domain: modelDomainOf(model),
        }));
    }

    function bindDomainPickerEvents() {
      const root = document.getElementById("metricModelPicker");
      if (!root || root.dataset.bound === "1") return;
      root.dataset.bound = "1";

      const modelTrigger = document.getElementById("metricModelTrigger");
      const modelSearch = document.getElementById("metricModelSearch");
      const modelList = document.getElementById("metricModelList");
      const modelTags = document.getElementById("metricModelTags");

      modelTrigger?.addEventListener("click", (event) => {
        if (event.target.closest("[data-remove-model]")) return;
        setModelPickerOpen(true);
        modelSearch?.focus();
        renderModelDropdown(modelSearch?.value || "");
      });
      modelSearch?.addEventListener("focus", () => {
        setModelPickerOpen(true);
        renderModelDropdown(modelSearch.value || "");
      });
      modelSearch?.addEventListener("input", () => {
        setModelPickerOpen(true);
        renderModelDropdown(modelSearch.value);
      });
      modelList?.addEventListener("change", (event) => {
        const input = event.target.closest('input[name="metricBoundModelPick"]');
        if (!input) return;
        if (input.checked) selectedModelKeys.add(input.value);
        else selectedModelKeys.delete(input.value);
        refreshModelPickerUi();
        renderTermSuggest(document.getElementById("metricTermSearch")?.value || "");
        renderTermRecommend(document.getElementById("metricNameInput")?.value || "");
      });
      modelTags?.addEventListener("click", (event) => {
        const btn = event.target.closest("[data-remove-model]");
        if (!btn) return;
        event.preventDefault();
        selectedModelKeys.delete(btn.dataset.removeModel);
        refreshModelPickerUi();
        renderTermSuggest(document.getElementById("metricTermSearch")?.value || "");
        renderTermRecommend(document.getElementById("metricNameInput")?.value || "");
      });

      document.addEventListener("click", (event) => {
        if (!document.getElementById("metricModelSelectPicker")?.contains(event.target)) {
          setModelPickerOpen(false);
        }
      });
    }

    function hideSqlSuggest() {
      const suggestEl = document.getElementById("metricSqlSuggest");
      if (suggestEl) {
        suggestEl.hidden = true;
        suggestEl.innerHTML = "";
      }
      sqlSuggestIndex = -1;
    }

    function selectedModelFieldSuggestions(keyword = "") {
      const fields = fieldsOfModels([...selectedModelKeys]);
      const q = keyword.trim().toLowerCase();
      if (!q) return fields.slice(0, 8);
      return fields
        .filter((f) => `${f.name} ${f.key}`.toLowerCase().includes(q))
        .slice(0, 8);
    }

    function currentSqlToken() {
      const el = document.getElementById("metricSqlInput");
      if (!el) return { token: "", start: 0, end: 0 };
      const value = el.value || "";
      const caret = el.selectionStart ?? value.length;
      const left = value.slice(0, caret);
      const match = left.match(/[A-Za-z0-9_\u4e00-\u9fa5]+$/);
      const token = match ? match[0] : "";
      return { token, start: caret - token.length, end: caret };
    }

    function renderSqlSuggest() {
      const suggestEl = document.getElementById("metricSqlSuggest");
      const sqlEl = document.getElementById("metricSqlInput");
      if (!suggestEl || !sqlEl || currentCalcMode() !== "sql") {
        hideSqlSuggest();
        return;
      }
      if (!selectedModelKeys.size) {
        suggestEl.hidden = false;
        suggestEl.innerHTML = `<div class="metric-sql-suggest-empty">请先选择模型，再联想字段</div>`;
        sqlSuggestIndex = -1;
        return;
      }
      const { token } = currentSqlToken();
      if (!token) {
        hideSqlSuggest();
        return;
      }
      const items = selectedModelFieldSuggestions(token);
      if (!items.length) {
        hideSqlSuggest();
        return;
      }
      sqlSuggestIndex = 0;
      suggestEl.hidden = false;
      suggestEl.innerHTML = items
        .map((item, index) => `
          <button class="metric-sql-suggest-item ${index === 0 ? "is-active" : ""}" type="button" role="option" data-sql-insert="${escapeHtml(item.key)}" data-sql-label="${escapeHtml(item.name)}">
            <span>${escapeHtml(item.name)}</span>
            <code>${escapeHtml(item.key)}</code>
          </button>
        `)
        .join("");
    }

    function applySqlSuggest(insertText) {
      if (!requireSelectedModelsForCalc()) return;
      const sqlEl = document.getElementById("metricSqlInput");
      if (!sqlEl || !insertText) return;
      const { start, end } = currentSqlToken();
      const value = sqlEl.value || "";
      sqlEl.value = `${value.slice(0, start)}${insertText}${value.slice(end)}`;
      const caret = start + String(insertText).length;
      sqlEl.focus();
      sqlEl.setSelectionRange(caret, caret);
      updateFormulaLineNums();
      refreshSqlStatus();
      hideSqlSuggest();
    }

    function bindSqlSuggestEvents() {
      const sqlEl = document.getElementById("metricSqlInput");
      const suggestEl = document.getElementById("metricSqlSuggest");
      if (!sqlEl || sqlEl.dataset.suggestBound === "1") return;
      sqlEl.dataset.suggestBound = "1";
      sqlEl.addEventListener("input", () => {
        updateFormulaLineNums();
        refreshSqlStatus();
        renderSqlSuggest();
      });
      sqlEl.addEventListener("keydown", (event) => {
        const open = suggestEl && !suggestEl.hidden;
        const items = open ? Array.from(suggestEl.querySelectorAll(".metric-sql-suggest-item")) : [];
        if (!open || !items.length) return;
        if (event.key === "ArrowDown") {
          event.preventDefault();
          sqlSuggestIndex = (sqlSuggestIndex + 1) % items.length;
          items.forEach((el, i) => el.classList.toggle("is-active", i === sqlSuggestIndex));
          return;
        }
        if (event.key === "ArrowUp") {
          event.preventDefault();
          sqlSuggestIndex = (sqlSuggestIndex - 1 + items.length) % items.length;
          items.forEach((el, i) => el.classList.toggle("is-active", i === sqlSuggestIndex));
          return;
        }
        if (event.key === "Enter" || event.key === "Tab") {
          const active = items[sqlSuggestIndex] || items[0];
          if (!active) return;
          event.preventDefault();
          applySqlSuggest(active.dataset.sqlInsert || active.dataset.sqlLabel || "");
          return;
        }
        if (event.key === "Escape") {
          hideSqlSuggest();
        }
      });
      suggestEl?.addEventListener("mousedown", (event) => {
        const item = event.target.closest("[data-sql-insert]");
        if (!item) return;
        event.preventDefault();
        applySqlSuggest(item.dataset.sqlInsert || item.dataset.sqlLabel || "");
      });
      sqlEl.addEventListener("blur", () => {
        window.setTimeout(hideSqlSuggest, 120);
      });
    }

    function currentLogicText() {
      const mode = currentCalcMode();
      if (mode === "sql") return (document.getElementById("metricSqlInput")?.value || "").trim();
      return (document.getElementById("metricFormulaInput")?.value || "").trim();
    }

    function showCalcResult(title, bodyHtml) {
      const panel = document.getElementById("metricCalcResult");
      const titleEl = document.getElementById("metricCalcResultTitle");
      const bodyEl = document.getElementById("metricCalcResultBody");
      if (!panel || !titleEl || !bodyEl) return;
      titleEl.textContent = title;
      bodyEl.innerHTML = bodyHtml;
      panel.hidden = false;
    }

    function hideCalcResult() {
      const panel = document.getElementById("metricCalcResult");
      if (panel) panel.hidden = true;
    }

    function runMetricLogicValidate() {
      if (!requireSelectedModelsForCalc()) return;
      const mode = currentCalcMode();
      const text = currentLogicText();
      const models = readSelectedModelsFromForm();
      const checks = [];
      if (!text) {
        checks.push({ ok: false, text: mode === "sql" ? "请先编写 SQL" : "请先填写计算公式" });
      } else {
        checks.push({ ok: true, text: "已填写计算逻辑" });
      }
      if (!models.length) {
        checks.push({ ok: false, text: "尚未选择模型，无法核对字段" });
      } else {
        checks.push({ ok: true, text: `已选择模型：${models.map((m) => m.name).join("、")}` });
      }
      if (text && mode !== "sql") {
        const parsed = parseFormulaFields(text);
        const valid = validateFormulaStatus(parsed);
        checks.push({
          ok: valid,
          text: document.getElementById("metricFormulaStatusText")?.textContent || (valid ? "计算有效" : "计算无效"),
        });
        if (models.length && parsed.fieldNames.length) {
          const available = new Set(fieldsOfModels(models.map((m) => m.name)).flatMap((f) => [f.name, f.key]));
          const missing = parsed.fieldNames.filter((name) => !available.has(name));
          checks.push(missing.length
            ? { ok: false, text: `所选模型缺少字段：${missing.join("、")}` }
            : { ok: true, text: `依赖字段均可在所选模型中找到：${parsed.fieldNames.join("、")}` });
        }
      }
      if (text && mode === "sql") {
        refreshSqlStatus();
        checks.push({
          ok: /^\s*select\b/i.test(text),
          text: /^\s*select\b/i.test(text) ? "SQL 以 SELECT 开头" : "建议以 SELECT 开头",
        });
        const parsed = parseFormulaFields(text);
        if (models.length && parsed.fieldNames.length) {
          const available = new Set(fieldsOfModels(models.map((m) => m.name)).flatMap((f) => [f.name, f.key]));
          const missing = parsed.fieldNames.filter((name) => !available.has(name));
          checks.push(missing.length
            ? { ok: false, text: `SQL 引用了模型中不存在的字段：${missing.join("、")}` }
            : { ok: true, text: `SQL 引用字段均可识别：${parsed.fieldNames.join("、")}` });
        }
      }
      const passed = checks.every((item) => item.ok);
      showCalcResult(passed ? "验证通过" : "验证未通过", checks
        .map((item) => `<div class="metric-calc-check ${item.ok ? "is-ok" : "is-bad"}">${item.ok ? "✓" : "!"} ${escapeHtml(item.text)}</div>`)
        .join(""));
      setTip(passed ? "计算逻辑验证通过" : "计算逻辑验证未通过");
    }

    function previewCell(field, index) {
      if (field.kind === "date") return `2026-0${index}-08`;
      if (field.kind === "dimension" && /月/.test(field.name)) return `2026-0${index}`;
      if (field.kind === "measure") return (1280 * index).toLocaleString("zh-CN");
      const samples = ["华东项目", "华南项目", "华北项目", "西南项目", "总部项目"];
      return samples[index - 1] || `示例${index}`;
    }

    function openMetricDataPreview() {
      if (!requireSelectedModelsForCalc()) return;
      const models = readSelectedModelsFromForm();
      if (!models.length) return;
      const text = currentLogicText();
      if (!text) {
        showCalcResult("数据预览", '<div class="metric-calc-check is-bad">! 请先填写计算逻辑后再预览</div>');
        setTip("请先填写计算逻辑后再预览");
        return;
      }
      const fields = fieldsOfModels(models.map((m) => m.name));
      const dims = fields.filter((f) => f.kind !== "measure").slice(0, 2);
      const measures = fields.filter((f) => f.kind === "measure").slice(0, 2);
      const cols = [...dims, ...measures].slice(0, 4);
      const previewCols = cols.length ? cols : fields.slice(0, 3);
      const rows = [1, 2, 3, 4, 5].map((index) => previewCols.map((field) => previewCell(field, index)));
      const html = `
        <div class="metric-calc-check is-ok">✓ 按所选模型抽样 5 行，数值为示意数据</div>
        <table class="metric-preview-table">
          <thead><tr>${previewCols.map((col) => `<th>${escapeHtml(col.name)}</th>`).join("")}</tr></thead>
          <tbody>
            ${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(String(cell))}</td>`).join("")}</tr>`).join("")}
          </tbody>
        </table>
      `;
      showCalcResult("数据预览", html);
      setTip(`已生成「${models.map((m) => m.name).join("、")}」的数据预览`);
    }

    function bindCalcActionEvents() {
      document.getElementById("metricValidateBtn")?.addEventListener("click", runMetricLogicValidate);
      document.getElementById("metricPreviewBtn")?.addEventListener("click", openMetricDataPreview);
      document.getElementById("metricCalcResultClose")?.addEventListener("click", hideCalcResult);
    }

    function currentCalcMode() {
      return document.querySelector(".metric-calc-mode.is-active")?.dataset.calcMode || "formula";
    }

    function activeLogicEditor() {
      const mode = currentCalcMode();
      if (mode === "sql") return document.getElementById("metricSqlInput");
      return document.getElementById("metricFormulaInput");
    }

    function normalizeCalcMode(mode) {
      if (mode === "chat") return "formula";
      return ["formula", "sql"].includes(mode) ? mode : "formula";
    }

    function metricAiChatEls() {
      return {
        log: document.getElementById("metricAiChatLog"),
        input: document.getElementById("metricAiChatInput"),
        drawer: document.getElementById("metricAiDrawer"),
        btn: document.getElementById("metricAiGenBtn"),
      };
    }

    function updateMetricAiDrawerHint() {
      const hintEl = document.getElementById("metricAiDrawerHint");
      const inputEl = document.getElementById("metricAiChatInput");
      if (!hintEl) return;
      const isSql = currentCalcMode() === "sql";
      hintEl.textContent = isSql
        ? "当前：SQL 模式 · 生成结果写入上方 SQL 编辑器"
        : "当前：公式模式 · 生成结果写入上方公式编辑器";
      if (inputEl) {
        inputEl.placeholder = isSql
          ? "用自然语言描述，如「统计各项目合同总额，排除作废状态」"
          : "用自然语言描述，如「按部门汇总合同额，不含作废合同」";
      }
    }

    function setMetricAiDrawerOpen(open) {
      const { drawer, btn, input } = metricAiChatEls();
      if (!drawer) return;
      drawer.classList.toggle("is-open", open);
      btn?.classList.toggle("is-active", open);
      btn?.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) {
        updateMetricAiDrawerHint();
        window.setTimeout(() => input?.focus(), 120);
      }
    }

    function toggleMetricAiDrawer() {
      const { drawer } = metricAiChatEls();
      if (!drawer) return;
      const willOpen = !drawer.classList.contains("is-open");
      if (willOpen && !requireSelectedModelsForCalc()) return;
      setMetricAiDrawerOpen(willOpen);
    }

    function bindMetricAiDrawerResize() {
      const drawer = document.getElementById("metricAiDrawer");
      const handle = document.getElementById("metricAiDrawerResize");
      if (!drawer || !handle || handle.dataset.bound === "1") return;
      handle.dataset.bound = "1";
      const clampHeight = (next) => {
        const parentH = drawer.parentElement?.clientHeight || 600;
        const maxH = Math.max(160, Math.floor(parentH * 0.85));
        return Math.min(maxH, Math.max(160, next));
      };
      const startDrag = (clientY) => {
        const startY = clientY;
        const startH = drawer.offsetHeight;
        const onMove = (ev) => {
          const y = ev.touches?.[0]?.clientY ?? ev.clientY;
          drawer.style.height = `${clampHeight(startH + (startY - y))}px`;
        };
        const onUp = () => {
          document.removeEventListener("mousemove", onMove);
          document.removeEventListener("mouseup", onUp);
          document.removeEventListener("touchmove", onMove);
          document.removeEventListener("touchend", onUp);
        };
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
        document.addEventListener("touchmove", onMove, { passive: false });
        document.addEventListener("touchend", onUp);
      };
      handle.addEventListener("mousedown", (event) => {
        event.preventDefault();
        startDrag(event.clientY);
      });
      handle.addEventListener("touchstart", (event) => {
        event.preventDefault();
        startDrag(event.touches[0]?.clientY ?? 0);
      }, { passive: false });
    }

    function applyCalcModeUi(mode) {
      const next = normalizeCalcMode(mode);
      document.querySelectorAll("[data-calc-mode]").forEach((btn) => {
        const active = btn.dataset.calcMode === next;
        btn.classList.toggle("is-active", active);
        btn.setAttribute("aria-selected", active ? "true" : "false");
      });
      document.querySelectorAll("[data-calc-panel]").forEach((panel) => {
        panel.hidden = panel.dataset.calcPanel !== next;
      });
      const modeInput = document.getElementById("metricCalcModeInput");
      if (modeInput) modeInput.value = next;
      if (next !== "sql") hideSqlSuggest();
      updateMetricAiDrawerHint();
    }

    function setCalcMode(mode) {
      if (!requireSelectedModelsForCalc()) return;
      applyCalcModeUi(mode);
    }

    function resetMetricAiChat() {
      const { log, input } = metricAiChatEls();
      if (log) log.innerHTML = "";
      if (input) input.value = "";
    }

    function appendInlineChatBubble(log, className, text) {
      if (!log) return;
      const bubble = document.createElement("div");
      bubble.className = `metric-chat-bubble ${className}`;
      bubble.textContent = text;
      log.appendChild(bubble);
      log.scrollTop = log.scrollHeight;
    }

    function draftFormulaFromChat(text) {
      const source = String(text || "");
      if (/签约率|完成率/.test(source)) return "SUM(col['contract_amt']) / NULLIF(SUM(col['target_amt']), 0)";
      if (/成本/.test(source)) return "SUM(col['cost_amt'])";
      if (/确认收入|收入/.test(source)) return "SUM(col['recognized_amt'])";
      if (/目标/.test(source)) return "SUM(col['target_amt'])";
      if (/合同/.test(source)) return "SUM(col['contract_amt'])";
      const name = (document.getElementById("metricNameInput")?.value || "").trim();
      if (/签约率|完成率/.test(name)) return "SUM(col['contract_amt']) / NULLIF(SUM(col['target_amt']), 0)";
      if (/成本/.test(name)) return "SUM(col['cost_amt'])";
      if (/收入/.test(name)) return "SUM(col['recognized_amt'])";
      if (/目标/.test(name)) return "SUM(col['target_amt'])";
      return "SUM(col['contract_amt'])";
    }

    function draftSqlFromChat(text) {
      const source = String(text || "");
      const models = readSelectedModelsFromForm();
      const tableHint = models.length ? "fact_table" : "contract_fact";
      const whereClause = /不含作废|排除作废|作废/.test(source) ? "\nWHERE status <> '作废'" : "";
      if (/签约率|完成率/.test(source)) {
        return `SELECT SUM(contract_amt) / NULLIF(SUM(target_amt), 0) AS metric_value\nFROM ${tableHint}${whereClause}`;
      }
      if (/成本/.test(source)) return `SELECT SUM(cost_amt) AS metric_value\nFROM ${tableHint}${whereClause}`;
      if (/确认收入|收入/.test(source)) return `SELECT SUM(recognized_amt) AS metric_value\nFROM ${tableHint}${whereClause}`;
      if (/目标/.test(source)) return `SELECT SUM(target_amt) AS metric_value\nFROM ${tableHint}${whereClause}`;
      if (/合同/.test(source)) return `SELECT SUM(contract_amt) AS metric_value\nFROM ${tableHint}${whereClause}`;
      const name = (document.getElementById("metricNameInput")?.value || "").trim();
      if (/签约率|完成率/.test(name)) {
        return `SELECT SUM(contract_amt) / NULLIF(SUM(target_amt), 0) AS metric_value\nFROM ${tableHint}${whereClause}`;
      }
      if (/成本/.test(name)) return `SELECT SUM(cost_amt) AS metric_value\nFROM ${tableHint}${whereClause}`;
      if (/收入/.test(name)) return `SELECT SUM(recognized_amt) AS metric_value\nFROM ${tableHint}${whereClause}`;
      if (/目标/.test(name)) return `SELECT SUM(target_amt) AS metric_value\nFROM ${tableHint}${whereClause}`;
      return `SELECT SUM(contract_amt) AS metric_value\nFROM ${tableHint}${whereClause}`;
    }

    function applyChatFormula(formula) {
      const formulaEl = document.getElementById("metricFormulaInput");
      if (formulaEl) formulaEl.value = formula;
      updateFormulaLineNums();
      refreshFormulaParsePreview();
    }

    function applyChatSql(sql) {
      const sqlEl = document.getElementById("metricSqlInput");
      if (sqlEl) sqlEl.value = sql;
      updateFormulaLineNums();
      refreshSqlStatus();
    }

    function sendMetricAiChat() {
      if (!requireSelectedModelsForCalc()) return;
      const nextMode = currentCalcMode();
      const { log, input } = metricAiChatEls();
      const text = (input?.value || "").trim();
      if (!text) return;
      if (input) input.value = "";
      appendInlineChatBubble(log, "is-user", text);
      if (nextMode === "sql") {
        const sql = draftSqlFromChat(text);
        applyChatSql(sql);
        appendInlineChatBubble(log, "is-assistant", "已生成 SQL 并写入上方编辑器，可继续手动调整。");
      } else {
        const formula = draftFormulaFromChat(text);
        applyChatFormula(formula);
        appendInlineChatBubble(log, "is-assistant", "已生成公式并写入上方编辑器，可继续手动调整。");
      }
    }

    function refreshSqlStatus() {
      const statusEl = document.getElementById("metricSqlStatusEl");
      const statusTextEl = document.getElementById("metricSqlStatusText");
      const sql = (document.getElementById("metricSqlInput")?.value || "").trim();
      if (!statusEl || !statusTextEl) return;
      const valid = Boolean(sql);
      statusEl.classList.toggle("is-invalid", !valid);
      statusTextEl.textContent = valid ? "SQL 已填写" : "请输入 SQL";
    }

    function insertTextIntoFormula(text) {
      if (!requireSelectedModelsForCalc()) return;
      const formulaEl = activeLogicEditor();
      if (!formulaEl || text == null) return;
      const start = formulaEl.selectionStart ?? formulaEl.value.length;
      const end = formulaEl.selectionEnd ?? formulaEl.value.length;
      const value = formulaEl.value || "";
      formulaEl.value = `${value.slice(0, start)}${text}${value.slice(end)}`;
      const caret = start + String(text).length;
      formulaEl.focus();
      formulaEl.setSelectionRange(caret, caret);
      updateFormulaLineNums();
      if (formulaEl.id === "metricFormulaInput") refreshFormulaParsePreview();
      if (formulaEl.id === "metricSqlInput") refreshSqlStatus();
    }

    function updateEditorLineNums(editorId, numsId) {
      const lineNumsEl = document.getElementById(numsId);
      const formulaEl = document.getElementById(editorId);
      if (!lineNumsEl || !formulaEl) return;
      const lineCount = Math.max(1, String(formulaEl.value || "").split("\n").length);
      lineNumsEl.innerHTML = Array.from({ length: lineCount }, (_, i) => `<span>${i + 1}</span>`).join("");
    }

    function updateFormulaLineNums() {
      updateEditorLineNums("metricFormulaInput", "metricFormulaLineNums");
      updateEditorLineNums("metricSqlInput", "metricSqlLineNums");
    }

    function validateFormulaStatus(parsed) {
      const statusEl = document.getElementById("metricFormulaStatusEl");
      const statusTextEl = document.getElementById("metricFormulaStatusText");
      const formulaEl = document.getElementById("metricFormulaInput");
      if (!statusEl || !statusTextEl || !formulaEl) return true;
      const formula = formulaEl.value.trim();
      let valid = Boolean(formula);
      let message = "计算有效";
      if (!formula) {
        valid = false;
        message = "请输入计算逻辑";
      } else {
        const openRound = (formula.match(/\(/g) || []).length;
        const closeRound = (formula.match(/\)/g) || []).length;
        const openSquare = (formula.match(/\[/g) || []).length;
        const closeSquare = (formula.match(/\]/g) || []).length;
        if (openRound !== closeRound || openSquare !== closeSquare) {
          valid = false;
          message = "括号不匹配";
        } else if (!(parsed?.fieldNames?.length)) {
          message = "未识别到依赖字段（可选）";
        }
      }
      statusEl.classList.toggle("is-invalid", !valid);
      statusTextEl.textContent = message;
      return valid;
    }

    function renderCalcDataTree() {
      const trees = document.querySelectorAll(".indicator-calc-data-tree");
      if (!trees.length) return;
      const tableLabels = {
        dwd_contract: "合同事实表",
        dwd_revenue_detail: "确收明细表",
        dwd_cost_detail: "成本明细表",
        dwd_cost_budget: "成本预算表",
        dwd_inbound: "入库明细表",
        dwd_project: "项目维表",
        dim_org: "组织维表",
        org: "组织维表",
        dim_material: "物料维表",
        dim_supplier: "供应商维表",
      };
      const extraTable = {
        物料名称: { code: "dim_material", key: "material_name" },
        供应商名称: { code: "dim_supplier", key: "supplier_name" },
      };
      const leafHtml = (f) => {
        const typeIcon = f.kind === "measure" ? "#" : f.kind === "date" ? "D" : "Abc";
        const typeClass = f.kind === "measure" ? "" : "is-text";
        const insertExpr = `col['${f.key}']`;
        return `<div
          class="indicator-calc-leaf"
          data-insert="${escapeHtml(insertExpr)}"
          data-label="${escapeHtml(f.name)}"
          data-key="${escapeHtml(f.key)}"
          title="${escapeHtml(`双击插入：${f.name} / ${f.key}`)}"
        >
          <span class="indicator-calc-leaf-type ${typeClass}">${typeIcon}</span>
          <span class="indicator-calc-leaf-meta">
            <span class="indicator-calc-leaf-name">${escapeHtml(f.name)}</span>
            <span class="indicator-calc-leaf-en">${escapeHtml(f.key)}</span>
          </span>
        </div>`;
      };
      const groupFieldsByTable = (modelName) => {
        const groups = new Map();
        fieldsOfModels([modelName]).forEach((field) => {
          const extra = extraTable[field.name];
          const fqnParts = String(field.fqn || "").split(".").filter(Boolean);
          const code = extra?.code || (fqnParts.length >= 2 ? fqnParts[fqnParts.length - 2] : "other");
          const tableName = tableLabels[code] || (code === "other" ? "其他字段" : code);
          if (!groups.has(code)) groups.set(code, { code, name: tableName, fields: [] });
          groups.get(code).fields.push({
            ...field,
            key: extra?.key || field.key,
          });
        });
        return [...groups.values()];
      };
      const models = getAllBusinessModels().filter((model) => selectedModelKeys.has(model.name));
      let html = "";
      if (!models.length) {
        html = `<div class="indicator-calc-leaf-empty">请先选择模型，展开后查看表和字段</div>`;
      } else {
        const byDomain = new Map();
        models.forEach((model) => {
          const seed = MODEL_CATALOG.find((item) => item.name === model.name);
          const domain = model.domain || seed?.domain || "未分域";
          if (!byDomain.has(domain)) byDomain.set(domain, []);
          byDomain.get(domain).push(model);
        });
        html = [...byDomain.entries()]
          .map(([domain, domainModels]) => domainModels.map((model) => {
            const tables = groupFieldsByTable(model.name);
            const tableHtml = tables
              .map((table) => `
                <div class="indicator-calc-folder indicator-calc-table is-open">
                  <div class="indicator-calc-folder-head" data-folder-toggle="1">
                    <span class="indicator-calc-folder-caret"></span>
                    <span class="indicator-calc-folder-icon is-table"></span>
                    <span>${escapeHtml(table.name)}</span>
                  </div>
                  <div class="indicator-calc-folder-body">
                    ${table.fields.length ? table.fields.map(leafHtml).join("") : '<div class="indicator-calc-leaf-empty">暂无字段</div>'}
                  </div>
                </div>
              `)
              .join("");
            return `
              <div class="indicator-calc-folder indicator-calc-model" data-domain="${escapeHtml(domain)}" data-model="${escapeHtml(model.name)}">
                <div class="indicator-calc-folder-head" data-folder-toggle="1">
                  <span class="indicator-calc-folder-caret"></span>
                  <span class="indicator-calc-pair">
                    <span class="indicator-calc-domain">${escapeHtml(domain)}</span>
                    <span class="indicator-calc-pair-sep">/</span>
                    <span class="indicator-calc-model-name">${escapeHtml(model.name)}</span>
                  </span>
                </div>
                <div class="indicator-calc-folder-body">
                  ${tableHtml || '<div class="indicator-calc-leaf-empty">该模型暂无表</div>'}
                </div>
              </div>
            `;
          }).join(""))
          .join("");
      }
      trees.forEach((treeEl) => {
        treeEl.innerHTML = html;
      });
      document.querySelectorAll(".indicator-calc-data-search").forEach((searchEl) => {
        if (searchEl.value) filterCalcDataTree(searchEl.value, searchEl.closest(".indicator-calc-logic")?.querySelector(".indicator-calc-data-tree"));
      });
    }

    function filterCalcDataTree(keyword = "", treeEl) {
      const trees = treeEl ? [treeEl] : Array.from(document.querySelectorAll(".indicator-calc-data-tree"));
      const q = keyword.trim().toLowerCase();
      trees.forEach((root) => {
        if (!root) return;
        root.querySelectorAll(".indicator-calc-folder").forEach((folder) => {
          let visibleCount = 0;
          folder.querySelectorAll(".indicator-calc-leaf").forEach((leaf) => {
            const label = `${leaf.dataset.label || ""} ${leaf.dataset.key || ""} ${leaf.textContent || ""}`.toLowerCase();
            const matched = !q || label.includes(q);
            leaf.hidden = !matched;
            if (matched) visibleCount += 1;
          });
          folder.hidden = Boolean(q) && visibleCount === 0;
          if (q && visibleCount > 0) folder.classList.add("is-open");
        });
      });
    }

    function refreshFormulaParsePreview() {
      const formula = document.getElementById("metricFormulaInput")?.value || "";
      const parsed = parseFormulaFields(formula);
      validateFormulaStatus(parsed);
      const el = document.getElementById("metricFormulaParsePreview");
      if (!el) return;
      if (!parsed.fieldNames.length) {
        el.textContent = "尚未识别到依赖字段。可双击右侧数据列插入 col['字段']。";
        el.className = "metric-parse-preview is-warn";
        return;
      }
      el.textContent = `依赖字段：${parsed.fieldNames.join("、")}`;
      el.className = "metric-parse-preview is-ok";
    }

    function toggleScopeFields() {
      /* 域选择不再随作用域显隐 */
    }

    function highlightHtml(value, query) {
      const text = String(value ?? "");
      const keyword = String(query || "").trim();
      if (!keyword) return escapeHtml(text);
      const reg = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
      let html = "";
      let last = 0;
      let hit = false;
      text.replace(reg, (match, index) => {
        hit = true;
        html += escapeHtml(text.slice(last, index));
        html += `<span class="list-highlight">${escapeHtml(match)}</span>`;
        last = index + match.length;
        return match;
      });
      if (!hit) return escapeHtml(text);
      return html + escapeHtml(text.slice(last));
    }

    function renderMetricTable() {
      if (!metricTbodyEl) return;
      const selectAllEl = document.getElementById("metricListSelectAll");
      const queryRaw = (metricSearchEl?.value || "").trim();
      const q = queryRaw.toLowerCase();
      const canAccessDomain = global.PermissionModule?.canAccessDomain || global.DataScope?.canAccessDomain;
      const project = (document.getElementById("projectFilterSelect")?.value || "pmlead-市场指标").trim();
      const rows = metrics.filter((m) => {
        const domains = Array.isArray(m.domains) && m.domains.length
          ? m.domains
          : String(m.domain || "").split(/[、,，]/).map((s) => s.trim()).filter(Boolean);
        if (canAccessDomain && domains.length && !domains.some((d) => canAccessDomain(d, { project }))) return false;
        if (domainFilter) {
          if (!domains.includes(domainFilter)) return false;
        }
        if (!q) return true;
        return [m.name, m.code, m.kind, m.caliber, m.domain, bizDateLabel(m), scopeLabel(m), dimLabel(m), chartStyleLabel(m.chartStyle), (m.domainModels || []).map((d) => d.name).join(","), (m.boundModelNames || []).join(",")]
          .join(" ")
          .toLowerCase()
          .includes(q);
      });
      metricTbodyEl.innerHTML = rows
        .map((m, index) => `
          <tr data-metric-id="${escapeHtml(m.id)}" class="${m.online === false ? "is-offline" : ""}">
            <td class="col-check"><input type="checkbox" class="metric-row-check" aria-label="选择行" data-metric-id="${escapeHtml(m.id)}" /></td>
            <td class="col-index">${index + 1}</td>
            <td>
              <a class="name-link metric-name-link" href="#">${highlightHtml(m.name, queryRaw)}</a>
              <div class="metric-code">${highlightHtml(m.code, queryRaw)}</div>
              <div class="metric-term-tags" style="margin-top:4px;">
                ${(m.termIds || [])
                  .map((id) => {
                    const t = termById(id);
                    if (!t) return "";
                    return `<span class="metric-term-tag" data-open-term="${escapeHtml(id)}">${highlightHtml(t.name, queryRaw)}</span>`;
                  })
                  .join("") || ""}
              </div>
            </td>
            <td class="domain-cell" title="${escapeHtml(dataDomainLabel(m))}">${highlightHtml(dataDomainLabel(m), queryRaw)}</td>
            <td><span class="metric-kind-pill ${m.kind === "derived" ? "is-derived" : "is-atomic"}">${highlightHtml(m.kind === "derived" ? "派生" : "基础", queryRaw)}</span></td>
            <td title="${escapeHtml(m.caliber)}">${highlightHtml(m.caliber, queryRaw)}</td>
            <td title="${escapeHtml(bizDateLabel(m))}">${highlightHtml(bizDateLabel(m), queryRaw)}</td>
            <td title="${escapeHtml(dimLabel(m))}">${highlightHtml(dimLabel(m), queryRaw)}</td>
            <td>${highlightHtml(chartStyleLabel(m.chartStyle), queryRaw)}</td>
            <td><code class="metric-formula-cell">${highlightHtml(m.formula, queryRaw)}</code></td>
            <td>${highlightHtml((m.fieldNames || []).join("、") || "-", queryRaw)}</td>
            <td>${highlightHtml((m.boundModelNames || []).join("、") || "未绑定", queryRaw)}</td>
            <td><span class="publish-pill ${m.status === "published" ? "is-published" : "is-draft"}">${statusLabel(m.status)}</span></td>
            <td>
              <a class="op-link" href="#" data-metric-action="online">${m.online !== false ? "下线" : "上线"}</a>
              <a class="op-link" href="#" data-metric-action="edit">编辑</a>
              <a class="op-link" href="#" data-metric-action="bind">绑定模型</a>
              <a class="op-link" href="#" data-metric-action="delete">删除</a>
            </td>
          </tr>
        `)
        .join("");
      syncMetricSelectAll();
      if (selectAllEl && selectAllEl.dataset.bound !== "1") {
        selectAllEl.dataset.bound = "1";
        selectAllEl.addEventListener("change", () => {
          metricTbodyEl.querySelectorAll(".metric-row-check").forEach((checkbox) => {
            checkbox.checked = selectAllEl.checked;
            checkbox.closest("tr")?.classList.toggle("is-selected", checkbox.checked);
          });
          syncMetricSelectAll();
        });
      }
    }

    function syncMetricSelectAll() {
      const selectAllEl = document.getElementById("metricListSelectAll");
      if (!selectAllEl || !metricTbodyEl) return;
      const checks = Array.from(metricTbodyEl.querySelectorAll(".metric-row-check"));
      const checked = checks.filter((el) => el.checked).length;
      selectAllEl.disabled = checks.length === 0;
      selectAllEl.checked = checks.length > 0 && checked === checks.length;
      selectAllEl.indeterminate = checked > 0 && checked < checks.length;
    }

    let lastStructureCatalog = "data-model";

    function switchCatalog(catalog) {
      const isHome = catalog === "home";
      const isMetric = catalog === "metric";
      const isTerm = catalog === "term";
      const isDoc = catalog === "document";
      const isPermission = catalog === "permission";
      const isModel = catalog === "data-model" || (!isHome && !isMetric && !isTerm && !isDoc && !isPermission);
      const primary = isHome
        ? "home"
        : isTerm
          ? "term"
          : isDoc
            ? "document"
            : isPermission
              ? "permission"
              : "structure";
      if (isModel || isMetric) lastStructureCatalog = isMetric ? "metric" : "data-model";
      const listViewEl = document.getElementById("listView");
      if (listViewEl) {
        listViewEl.dataset.activeCatalog = isHome
          ? "home"
          : isMetric
            ? "metric"
            : isTerm
              ? "term"
              : isDoc
                ? "document"
                : isPermission
                  ? "permission"
                  : "data-model";
      }
      document.querySelectorAll(".list-primary-tab").forEach((tab) => {
        const active = tab.dataset.listPrimary === primary;
        tab.classList.toggle("active", active);
        tab.setAttribute("aria-selected", active ? "true" : "false");
      });
      const structureSubTabs = document.getElementById("structureSubTabs");
      if (structureSubTabs) structureSubTabs.hidden = primary !== "structure";
      document.querySelectorAll(".list-catalog-tab").forEach((tab) => {
        const active = tab.dataset.listCatalog === (isMetric ? "metric" : "data-model");
        tab.classList.toggle("active", primary === "structure" && active);
        tab.setAttribute("aria-selected", primary === "structure" && active ? "true" : "false");
      });
      const homePanelEl = document.getElementById("listCatalogHomePanel");
      if (homePanelEl) homePanelEl.hidden = !isHome;
      if (modelPanelEl) modelPanelEl.hidden = !isModel;
      if (metricPanelEl) metricPanelEl.hidden = !isMetric;
      const termPanelEl = document.getElementById("listCatalogTermPanel");
      if (termPanelEl) termPanelEl.hidden = !isTerm;
      const termListMetaEl = document.getElementById("termListMeta");
      if (termListMetaEl) termListMetaEl.hidden = !isTerm;
      const termPagerWrapEl = document.getElementById("termPager");
      if (termPagerWrapEl && !isTerm) termPagerWrapEl.hidden = true;
      const docPanelEl = document.getElementById("listCatalogDocPanel");
      if (docPanelEl) docPanelEl.hidden = !isDoc;
      const permissionPanelEl = document.getElementById("listCatalogPermissionPanel");
      if (permissionPanelEl) permissionPanelEl.hidden = !isPermission;
      if (modelActionsEl) modelActionsEl.hidden = !isModel;
      if (metricActionsEl) metricActionsEl.hidden = !isMetric;
      const termActionsEl = document.getElementById("listCatalogTermActions");
      if (termActionsEl) termActionsEl.hidden = !isTerm;
      const docActionsEl = document.getElementById("listCatalogDocActions");
      if (docActionsEl) docActionsEl.hidden = !isDoc;
      const projectFilterField = document.getElementById("projectFilterField");
      if (projectFilterField) projectFilterField.hidden = isHome || isTerm || isDoc || isPermission;
      const domainFilterField = document.getElementById("domainFilterField");
      if (domainFilterField) domainFilterField.hidden = !(isTerm || isDoc);
      if (isTerm || isDoc) window.syncCatalogDomainFilterSelect?.();
      const domainPanel = document.getElementById("domainFilterPanel");
      if (domainPanel && !domainPanel.hidden) {
        domainPanel.hidden = true;
        document.querySelectorAll("[data-domain-filter-catalog]").forEach((btn) => {
          btn.classList.remove("is-open");
          btn.setAttribute("aria-expanded", "false");
        });
      }
      if (isMetric) renderMetricTable();
      if (isTerm && window.BizTermUI?.render) window.BizTermUI.render();
      if (isHome) window.BizLineageUI?.render?.();
      if (isPermission) window.BizPermissionUI?.renderPermissionPanel?.();
      if (typeof setTip === "function") {
        if (isHome) {
          setTip("语义首页：按术语/模型/指标/文档查看语义血缘图谱。");
        } else if (isPermission) {
          setTip("权限中心：配置平台角色与数据域/组织行权限，并预览 MCP 数据范围。");
        } else if (isMetric) {
          setTip("结构语义 · 指标：维护可问数的指标口径与计算逻辑。");
        } else if (isTerm) {
          setTip("术语中心：维护业务术语与同义词，上线后可供指标/字段挂载。");
        } else if (isDoc) {
          setTip("文档中心：上传并管理知识文档，供问数挂接与口径解释。");
        } else {
          setTip("结构语义 · 模型：维护域模型与基础模型。");
        }
      }
    }

    function shouldAutoFillMetricCode() {
      if (metricCodeManualEdited) return false;
      const current = (document.getElementById("metricCodeInput")?.value || "").trim();
      return !current || current === metricCodeAutoValue;
    }

    function syncMetricEnglishCodeFromName({ force = false } = {}) {
      const nameEl = document.getElementById("metricNameInput");
      const codeEl = document.getElementById("metricCodeInput");
      if (!nameEl || !codeEl) return;
      if (!force && !shouldAutoFillMetricCode()) return;
      const next = buildMetricEnglishCodeFromName(nameEl.value);
      metricCodeAutoValue = next;
      codeEl.value = next;
      metricCodeManualEdited = false;
    }

    function openCreateModal(metric) {
      editingId = metric?.id || null;
      document.getElementById("metricCreateTitle").textContent = metric ? "编辑指标" : "创建指标";
      document.getElementById("metricNameInput").value = metric?.name || "";
      const codeEl = document.getElementById("metricCodeInput");
      if (metric?.code) {
        codeEl.value = metric.code;
        metricCodeAutoValue = metric.code;
        metricCodeManualEdited = true;
      } else {
        metricCodeManualEdited = false;
        metricCodeAutoValue = "";
        codeEl.value = "";
        syncMetricEnglishCodeFromName({ force: true });
      }
      document.getElementById("metricCaliberInput").value = metric?.caliber || "";
      const rawCalcMode = metric?.calcMode || "formula";
      const calcMode = normalizeCalcMode(rawCalcMode);
      const formulaText = metric?.formula || "";
      document.getElementById("metricFormulaInput").value = calcMode === "sql" ? "" : formulaText;
      const sqlInput = document.getElementById("metricSqlInput");
      if (sqlInput) sqlInput.value = calcMode === "sql" ? formulaText : "";
      resetMetricAiChat();
      setMetricAiDrawerOpen(false);
      document.getElementById("metricStatusSelect").value = metric
        ? (metric.online === false ? "offline" : "online")
        : "online";
      selectedTermIds = new Set(metric?.termIds || []);
      renderSelectedTermTags();
      const termSearch = document.getElementById("metricTermSearch");
      if (termSearch) termSearch.value = "";
      renderTermSuggest("");
      renderTermRecommend(metric?.name || "");
      const catalog = getAllBusinessModels();
      const modelSeed = ((metric?.domainModels || []).length
        ? metric.domainModels
        : (metric?.boundModelNames || []).map((name, idx) => ({
            id: metric?.boundModelIds?.[idx] || name,
            name,
            type: "域模型",
          }))
      ).map((item) => {
        const found = catalog.find((m) => m.name === item.name || m.id === item.id);
        return {
          id: item.id || found?.id || item.name,
          name: item.name || found?.name,
          type: item.type || found?.type || "域模型",
          domain: item.domain || found?.domain || "",
        };
      });
      initModelPicker(modelSeed);
      applyCalcModeUi(calcMode);
      refreshSqlStatus();
      renderCalcDataTree();
      fillBizDateSelect(metric?.defaultBizDate?.key || "");
      renderBoundDimensionOptions(
        (metric?.boundDimensions || []).map((d) => d.key),
        metric?.defaultDimensionKey || ""
      );
      setChartStyleForm(metric?.chartStyle || DEFAULT_CHART_STYLE);
      updateFormulaLineNums();
      refreshFormulaParsePreview();
      const searchEl = document.getElementById("metricCalcDataSearch");
      if (searchEl) searchEl.value = "";
      if (listViewEl) listViewEl.hidden = true;
      if (modelViewEl) modelViewEl.hidden = true;
      if (modalEl) {
        modalEl.hidden = false;
        modalEl.setAttribute("aria-label", metric ? "编辑指标" : "创建指标");
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    function closeCreateModal() {
      if (modalEl) modalEl.hidden = true;
      if (modelViewEl) modelViewEl.hidden = true;
      if (listViewEl) listViewEl.hidden = false;
      editingId = null;
      setModelPickerOpen(false);
      hideSqlSuggest();
      hideCalcResult();
      setMetricAiDrawerOpen(false);
      switchCatalog("metric");
    }

    function saveMetricFromForm(event) {
      event.preventDefault();
      const name = document.getElementById("metricNameInput").value.trim();
      const code = document.getElementById("metricCodeInput").value.trim();
      const caliber = document.getElementById("metricCaliberInput").value.trim();
      const calcMode = currentCalcMode();
      const formula = (calcMode === "sql"
        ? document.getElementById("metricSqlInput")?.value
        : document.getElementById("metricFormulaInput")?.value || ""
      ).trim();
      const online = document.getElementById("metricStatusSelect").value !== "offline";
      const status = online ? "published" : "draft";
      const old = editingId ? metrics.find((m) => m.id === editingId) : null;
      const scope = old?.scope || "global";
      const kind = old?.kind || "atomic";
      if (!name) {
        setTip("请填写指标名称");
        document.getElementById("metricNameInput")?.focus();
        return;
      }
      if (!code) {
        setTip("请填写英文名称");
        document.getElementById("metricCodeInput")?.focus();
        return;
      }
      const selectedModels = readSelectedModelsFromForm();
      const domains = [...new Set(selectedModels.map((model) => model.domain).filter(Boolean))];
      if (!selectedModels.length) {
        setTip("请选择模型");
        document.getElementById("metricModelSearch")?.focus();
        return;
      }
      if (!caliber) {
        setTip("请填写业务口径");
        document.getElementById("metricCaliberInput")?.focus();
        return;
      }
      if (!formula) {
        setTip(calcMode === "sql" ? "请编写 SQL" : "请填写计算逻辑");
        if (calcMode === "sql") document.getElementById("metricSqlInput")?.focus();
        else document.getElementById("metricFormulaInput")?.focus();
        return;
      }
      const defaultBizDate = readDefaultBizDateFromForm();
      const parsed = parseFormulaFields(formula);
      const boundDimensions = readBoundDimensionsFromForm();
      const defaultDimensionKey = readDefaultDimensionKeyFromForm(boundDimensions);
      const chartStyle = readChartStyleFromForm();
      let boardId = old?.boardId || "";
      let boardLabel = scope === "domain" ? "特定域" : "全局公共";
      const payload = normalizeMetric({
        id: editingId || uid("metric"),
        name,
        code,
        kind,
        scope,
        boardId,
        boardLabel,
        domains,
        domain: domains.join("、"),
        caliber,
        calcMode,
        formula,
        fieldKeys: parsed.fieldKeys,
        fieldNames: parsed.fieldNames,
        defaultBizDate,
        boundDimensions,
        defaultDimensionKey,
        chartStyle,
        domainModels: selectedModels,
        status,
        online,
        termIds: [...selectedTermIds],
        boundModelIds: selectedModels.map((m) => m.id),
        boundModelNames: selectedModels.map((m) => m.name),
        creator: "当前用户",
        updatedAt: nowStamp(),
      });
      if (editingId) {
        payload.creator = old?.creator || payload.creator;
        metrics = metrics.map((m) => (m.id === editingId ? payload : m));
      } else {
        metrics = [payload, ...metrics];
      }
      writeMetrics(metrics);
      if (payload.online !== false && payload.status === "published") syncMetricToSemanticBridge(payload);
      else removeMetricFromSemanticBridge(payload);
      renderMetricTable();
      closeCreateModal();
      const defaultDimName = boundDimensions.find((d) => d.key === defaultDimensionKey)?.name;
      const dimTip = boundDimensions.length
        ? `，分析维度：${boundDimensions.map((d) => d.name).join("、")}（默认：${defaultDimName}）`
        : "";
      setTip(editingId
        ? `已更新指标：${name}${dimTip}`
        : `已创建指标：${name}，默认${online ? "已上线" : "未上线"}${dimTip}`);
    }

    function openBindDrawer(metricId) {
      const metric = metrics.find((m) => m.id === metricId);
      if (!metric) return;
      bindingMetricId = metricId;
      document.getElementById("metricBindDrawerTitle").textContent = `绑定模型 · ${metric.name}`;
      const models = getBindableModels();
      const required = getMetricRequiredFieldNames(metric);
      bindBodyEl.innerHTML = `
        <div class="bridge-section">
          <h4>校验字段（公式依赖 + 默认业务日期 + 分析维度）</h4>
          <p class="metric-bind-deps">${required.map((n) => `<code>${escapeHtml(n)}</code>`).join(" ") || "无"}</p>
          <p class="metric-bind-tip">仅当目标模型元数据包含以上字段时才允许绑定；否则阻断并提示缺失字段。</p>
        </div>
        <div class="bridge-section">
          <h4>可选业务模型</h4>
          <div class="metric-bind-list">
            ${models
              .map((model) => {
                const result = validateMetricAgainstModel(metric, model.name);
                const checked = (metric.boundModelNames || []).includes(model.name);
                return `<label class="metric-bind-item ${result.ok ? "is-ok" : "is-bad"}">
                  <input type="checkbox" data-model-name="${escapeHtml(model.name)}" data-model-id="${escapeHtml(model.id)}" ${checked ? "checked" : ""} ${result.ok ? "" : "disabled"} />
                  <div class="metric-bind-main">
                    <strong>${escapeHtml(model.name)}</strong>
                    <span>${escapeHtml(model.type)}${model.domain ? " · " + escapeHtml(model.domain) : ""}</span>
                    <span class="metric-bind-result">${
                      result.ok
                        ? `可绑定（字段齐全：${result.required.join("、")}）`
                        : `不可绑定，缺少字段：${result.missing.join("、")}`
                    }</span>
                  </div>
                </label>`;
              })
              .join("")}
          </div>
          <div class="metric-bind-actions">
            <button type="button" class="btn-sync-query" id="metricBindConfirmBtn">确认绑定</button>
            <button type="button" class="model-switch" id="metricBindCancelBtn">取消</button>
          </div>
        </div>
      `;
      bindDrawerEl.hidden = false;
      global.syncDrawerBackdrop?.();
      document.getElementById("metricBindConfirmBtn")?.addEventListener("click", confirmBind);
      document.getElementById("metricBindCancelBtn")?.addEventListener("click", () => {
        bindDrawerEl.hidden = true;
        bindingMetricId = null;
        global.syncDrawerBackdrop?.();
      });
    }

    function confirmBind() {
      const metric = metrics.find((m) => m.id === bindingMetricId);
      if (!metric) return;
      const selected = [...bindBodyEl.querySelectorAll('input[type="checkbox"][data-model-name]:checked')];
      const names = [];
      const ids = [];
      const rejected = [];
      selected.forEach((input) => {
        const modelName = input.dataset.modelName;
        const result = validateMetricAgainstModel(metric, modelName);
        if (!result.ok) {
          rejected.push(`${modelName}（缺 ${result.missing.join("、")}）`);
          return;
        }
        names.push(modelName);
        ids.push(input.dataset.modelId);
      });
      if (rejected.length) {
        setTip(`绑定校验失败：${rejected.join("；")}`);
        return;
      }
      metric.boundModelNames = names;
      metric.boundModelIds = ids;
      metric.updatedAt = nowStamp();
      writeMetrics(metrics);
      syncMetricToSemanticBridge(metric);
      renderMetricTable();
      bindDrawerEl.hidden = true;
      bindingMetricId = null;
      global.syncDrawerBackdrop?.();
      setTip(names.length
        ? `已绑定 ${names.length} 个模型到指标「${metric.name}」`
        : `已清空「${metric.name}」的模型绑定`);
    }

    function onMetricTableClick(event) {
      const termTag = event.target.closest("[data-open-term]");
      if (termTag) {
        event.preventDefault();
        global.BizTermUI?.openDetail?.(termTag.dataset.openTerm);
        return;
      }
      const actionEl = event.target.closest("[data-metric-action]");
      const row = event.target.closest("tr[data-metric-id]");
      if (!row) return;
      const id = row.dataset.metricId;
      const metric = metrics.find((m) => m.id === id);
      if (!metric) return;

      if (event.target.closest(".metric-name-link")) {
        event.preventDefault();
        openCreateModal(metric);
        return;
      }
      if (!actionEl) return;
      event.preventDefault();
      const action = actionEl.dataset.metricAction;
      if (action === "edit") openCreateModal(metric);
      if (action === "bind") openBindDrawer(id);
      if (action === "online") {
        metric.online = metric.online === false;
        metric.updatedAt = nowStamp();
        writeMetrics(metrics);
        if (metric.online !== false && metric.status === "published") syncMetricToSemanticBridge(metric);
        else removeMetricFromSemanticBridge(metric);
        renderMetricTable();
        setTip(metric.online !== false
          ? `指标「${metric.name}」已上线，可对问数生效`
          : `指标「${metric.name}」已下线，暂不对问数生效`);
      }
      if (action === "delete") {
        if (!confirm(`确认删除指标「${metric.name}」？`)) return;
        removeMetricFromSemanticBridge(metric);
        metrics = metrics.filter((m) => m.id !== id);
        writeMetrics(metrics);
        renderMetricTable();
        setTip(`已删除指标：${metric.name}`);
      }
    }

    function renderMountList(keyword = "") {
      if (!mountListEl) return;
      const q = keyword.trim().toLowerCase();
      const mountedIds = new Set();
      if (mountTarget?.type === "field") {
        const map = global.TermModule?.readFieldTermMap?.() || {};
        (mountTarget.ids || []).forEach((key) => {
          (map[key] || []).forEach((id) => mountedIds.add(id));
        });
      } else if (mountTarget?.type === "metric" && mountTarget.ids?.length) {
        // 交集：所有勾选指标都已挂载的术语才预勾选，便于批量解绑
        const picked = metrics.filter((m) => mountTarget.ids.includes(m.id));
        const first = new Set(picked[0]?.termIds || []);
        picked.slice(1).forEach((m) => {
          const next = new Set(m.termIds || []);
          first.forEach((id) => {
            if (!next.has(id)) first.delete(id);
          });
        });
        first.forEach((id) => mountedIds.add(id));
      }
      const list = getMountableTerms().filter((t) => {
        if (!termFitsMountTarget(t, mountTarget)) return false;
        if (!q) return true;
        return [t.name, t.synonyms, t.domain, t.description].join(" ").toLowerCase().includes(q);
      });
      mountListEl.innerHTML = list.length
        ? list
            .map(
              (t) => `<label class="metric-term-option">
            <input type="checkbox" data-mount-term="${escapeHtml(t.id)}" ${mountedIds.has(t.id) ? "checked" : ""} />
            <span><strong>${escapeHtml(t.name)}</strong> · ${escapeHtml(t.domain || "")}<br/><span style="color:#98a2b3">${escapeHtml(t.synonyms || t.description || "无同义词")}</span></span>
          </label>`
            )
            .join("")
        : '<div class="metric-term-option is-disabled">当前数据域下暂无已上线术语</div>';
    }

    function openMountDrawer(target) {
      mountTarget = target;
      const hintEl = document.getElementById("termMountHint");
      if (mountTitleEl) {
        if (target.type === "field" && target.fieldLabel) {
          mountTitleEl.textContent = `挂载术语 · ${target.fieldLabel}`;
        } else if (target.type === "field") {
          mountTitleEl.textContent = `批量挂载术语 · ${target.ids.length} 个字段`;
        } else {
          mountTitleEl.textContent = `批量挂载术语 · ${target.ids.length} 个指标`;
        }
      }
      if (hintEl) {
        const domainText = (target.domains || []).filter(Boolean).join("、");
        hintEl.textContent = domainText
          ? `仅显示数据域「${domainText}」下已上线的术语，可按名称、同义词或描述搜索。`
          : "选择已上线术语，对勾选对象执行挂载或解绑。";
      }
      if (mountSearchEl) mountSearchEl.value = "";
      renderMountList("");
      if (mountDrawerEl) mountDrawerEl.hidden = false;
      global.syncDrawerBackdrop?.();
    }

    function closeMountDrawer() {
      if (mountDrawerEl) mountDrawerEl.hidden = true;
      mountTarget = null;
      global.syncDrawerBackdrop?.();
    }

    function selectedMountTermIds() {
      return Array.from(mountListEl?.querySelectorAll("[data-mount-term]:checked") || []).map(
        (el) => el.dataset.mountTerm
      );
    }

    function applyMount(unbind = false) {
      if (!mountTarget) return;
      const termIds = selectedMountTermIds();
      if (!termIds.length) {
        setTip("请先勾选要操作的术语");
        return;
      }
      if (mountTarget.type === "metric") {
        let count = 0;
        metrics = metrics.map((m) => {
          if (!mountTarget.ids.includes(m.id)) return m;
          const set = new Set(m.termIds || []);
          termIds.forEach((id) => {
            if (unbind) set.delete(id);
            else set.add(id);
          });
          count += 1;
          return { ...m, termIds: [...set], updatedAt: nowStamp() };
        });
        writeMetrics(metrics);
        renderMetricTable();
        setTip(unbind ? `已为 ${count} 个指标解绑术语` : `已为 ${count} 个指标挂载术语`);
      } else if (mountTarget.type === "field") {
        const map = global.TermModule?.readFieldTermMap?.() || {};
        mountTarget.ids.forEach((key) => {
          const set = new Set(map[key] || []);
          termIds.forEach((id) => {
            if (unbind) set.delete(id);
            else set.add(id);
          });
          map[key] = [...set];
          if (unbind) global.TermModule?.markFieldTermsDismissed?.(key, termIds);
          else global.TermModule?.clearFieldTermDismiss?.(key, termIds);
        });
        global.TermModule?.writeFieldTermMap?.(map);
        global.dispatchEvent(new CustomEvent("biz-field-terms-updated", { detail: map }));
        setTip(unbind ? `已为 ${mountTarget.ids.length} 个字段解绑术语` : `已为 ${mountTarget.ids.length} 个字段挂载术语`);
      }
      closeMountDrawer();
    }

    document.querySelectorAll(".list-primary-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        const primary = tab.dataset.listPrimary;
        if (primary === "home") switchCatalog("home");
        else if (primary === "term") switchCatalog("term");
        else if (primary === "document") switchCatalog("document");
        else if (primary === "permission") switchCatalog("permission");
        else switchCatalog(lastStructureCatalog);
      });
    });
    document.querySelectorAll(".list-catalog-tab").forEach((tab) => {
      tab.addEventListener("click", () => switchCatalog(tab.dataset.listCatalog));
    });
    createBtnEl?.addEventListener("click", () => openCreateModal(null));
    batchTermBtnEl?.addEventListener("click", () => {
      const ids = Array.from(metricTbodyEl?.querySelectorAll(".metric-row-check:checked") || []).map(
        (el) => el.dataset.metricId
      );
      if (!ids.length) {
        setTip("请先勾选要挂载术语的指标");
        return;
      }
      const picked = metrics.filter((item) => ids.includes(item.id));
      const domains = [...new Set(picked.flatMap((item) => metricDomainList(item)))];
      if (!domains.length) {
        setTip("所选指标未配置数据域，无法加载可挂载术语");
        return;
      }
      openMountDrawer({ type: "metric", ids, domains });
    });
    metricSearchEl?.addEventListener("input", renderMetricTable);
    metricTbodyEl?.addEventListener("click", onMetricTableClick);
    metricTbodyEl?.addEventListener("change", (event) => {
      const checkbox = event.target.closest(".metric-row-check");
      if (!checkbox) return;
      checkbox.closest("tr")?.classList.toggle("is-selected", checkbox.checked);
      syncMetricSelectAll();
    });
    formEl?.addEventListener("submit", saveMetricFromForm);
    document.getElementById("metricTermSearch")?.addEventListener("input", (event) => {
      renderTermSuggest(event.target.value);
    });
    document.getElementById("metricNameInput")?.addEventListener("input", (event) => {
      renderTermRecommend(event.target.value);
      syncMetricEnglishCodeFromName();
    });
    document.getElementById("metricNameInput")?.addEventListener("blur", () => {
      syncMetricEnglishCodeFromName();
    });
    document.getElementById("metricCodeInput")?.addEventListener("input", () => {
      const current = (document.getElementById("metricCodeInput")?.value || "").trim();
      metricCodeManualEdited = current !== metricCodeAutoValue;
    });
    document.getElementById("metricTermPicker")?.addEventListener("change", (event) => {
      const pick = event.target.closest("[data-term-pick]");
      if (!pick) return;
      const id = pick.dataset.termPick;
      if (pick.checked) selectedTermIds.add(id);
      else selectedTermIds.delete(id);
      renderSelectedTermTags();
      renderTermSuggest(document.getElementById("metricTermSearch")?.value || "");
      renderTermRecommend(document.getElementById("metricNameInput")?.value || "");
    });
    document.getElementById("metricTermTags")?.addEventListener("click", (event) => {
      const remove = event.target.closest("[data-remove-term]");
      if (remove) {
        event.preventDefault();
        selectedTermIds.delete(remove.dataset.removeTerm);
        renderSelectedTermTags();
        renderTermSuggest(document.getElementById("metricTermSearch")?.value || "");
        return;
      }
      const tag = event.target.closest(".metric-term-tag[data-term-id]");
      if (tag) {
        event.preventDefault();
        global.BizTermUI?.openDetail?.(tag.dataset.termId);
      }
    });
    mountSearchEl?.addEventListener("input", () => renderMountList(mountSearchEl.value));
    mountBindBtnEl?.addEventListener("click", () => applyMount(false));
    mountUnbindBtnEl?.addEventListener("click", () => applyMount(true));
    mountCloseBtnEl?.addEventListener("click", closeMountDrawer);
    mountCancelBtnEl?.addEventListener("click", closeMountDrawer);
    bindChartStyleEvents();
    bindDomainPickerEvents();
    bindSqlSuggestEvents();
    bindCalcActionEvents();
    document.getElementById("backFromMetricEditBtn")?.addEventListener("click", closeCreateModal);
    document.getElementById("cancelMetricCreateBtn")?.addEventListener("click", closeCreateModal);
    document.getElementById("closeMetricBindDrawerBtn")?.addEventListener("click", () => {
      bindDrawerEl.hidden = true;
      bindingMetricId = null;
      global.syncDrawerBackdrop?.();
    });
    const formulaInputEl = document.getElementById("metricFormulaInput");
    formulaInputEl?.addEventListener("focus", () => {
      if (!hasSelectedCalcModels()) {
        formulaInputEl.blur();
        promptSelectModelForCalc();
      }
    });
    formulaInputEl?.addEventListener("input", () => {
      updateFormulaLineNums();
      refreshFormulaParsePreview();
    });
    formulaInputEl?.addEventListener("scroll", () => {
      const lineNumsEl = document.getElementById("metricFormulaLineNums");
      if (lineNumsEl && formulaInputEl) lineNumsEl.scrollTop = formulaInputEl.scrollTop;
    });
    const sqlInputEl = document.getElementById("metricSqlInput");
    sqlInputEl?.addEventListener("focus", () => {
      if (!hasSelectedCalcModels()) {
        sqlInputEl.blur();
        promptSelectModelForCalc();
      }
    });
    sqlInputEl?.addEventListener("scroll", () => {
      const lineNumsEl = document.getElementById("metricSqlLineNums");
      if (lineNumsEl && sqlInputEl) lineNumsEl.scrollTop = sqlInputEl.scrollTop;
    });
    document.getElementById("metricCalcColumn")?.addEventListener("click", (event) => {
      const modeBtn = event.target.closest("[data-calc-mode]");
      if (modeBtn) setCalcMode(modeBtn.dataset.calcMode);
    });
    document.getElementById("metricAiGenBtn")?.addEventListener("click", toggleMetricAiDrawer);
    document.getElementById("metricAiDrawerCloseBtn")?.addEventListener("click", () => setMetricAiDrawerOpen(false));
    document.getElementById("metricAiChatSendBtn")?.addEventListener("click", sendMetricAiChat);
    document.getElementById("metricAiChatInput")?.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendMetricAiChat();
      }
    });
    bindMetricAiDrawerResize();
    document.getElementById("metricCalcOpsBar")?.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-op]");
      if (!btn) return;
      insertTextIntoFormula(btn.dataset.op || "");
    });
    const calcTreeEl = document.getElementById("metricCalcColumn");
    calcTreeEl?.addEventListener("click", (event) => {
      const toggle = event.target.closest("[data-folder-toggle]");
      if (toggle) {
        toggle.closest(".indicator-calc-folder")?.classList.toggle("is-open");
        return;
      }
      const leaf = event.target.closest(".indicator-calc-leaf");
      if (!leaf) return;
      calcTreeEl.querySelectorAll(".indicator-calc-leaf.is-active").forEach((el) => el.classList.remove("is-active"));
      leaf.classList.add("is-active");
    });
    calcTreeEl?.addEventListener("dblclick", (event) => {
      const leaf = event.target.closest(".indicator-calc-leaf");
      if (!leaf) return;
      event.preventDefault();
      insertTextIntoFormula(leaf.dataset.insert || leaf.dataset.key || "");
    });
    document.getElementById("metricCalcColumn")?.addEventListener("input", (event) => {
      const searchEl = event.target.closest(".indicator-calc-data-search");
      if (!searchEl) return;
      filterCalcDataTree(searchEl.value, searchEl.closest(".indicator-calc-logic")?.querySelector(".indicator-calc-data-tree"));
    });

    window.addEventListener("biz-metrics-updated", () => {
      metrics = readMetrics();
      renderMetricTable();
    });

    // 需求调整：「语义首页」页签已隐藏，默认激活改为「术语中心」
    switchCatalog("term");

    return {
      switchCatalog,
      renderMetricTable,
      validateMetricAgainstModel,
      getMetrics: () => metrics.slice(),
      openCreateModal,
      openMountDrawer,
      getSelectedIds() {
        return Array.from(metricTbodyEl?.querySelectorAll(".metric-row-check:checked") || []).map(
          (el) => el.dataset.metricId
        );
      },
      batchMoveDomain(ids, domain) {
        const idSet = new Set(ids || []);
        let count = 0;
        metrics = metrics.map((m) => {
          if (!idSet.has(m.id)) return m;
          count += 1;
          return { ...m, domain, updatedAt: nowStamp() };
        });
        writeMetrics(metrics);
        renderMetricTable();
        setTip(`已将 ${count} 条指标移动到数据域「${domain}」`);
      },
      batchSetOnline(ids, online) {
        const idSet = new Set(ids || []);
        let count = 0;
        metrics = metrics.map((m) => {
          if (!idSet.has(m.id)) return m;
          count += 1;
          const next = { ...m, online: Boolean(online), updatedAt: nowStamp() };
          if (next.online !== false && next.status === "published") syncMetricToSemanticBridge(next);
          else removeMetricFromSemanticBridge(next);
          return next;
        });
        writeMetrics(metrics);
        renderMetricTable();
        setTip(`已将 ${count} 条指标${online ? "上线" : "下线"}`);
      },
      batchDelete(ids) {
        const idSet = new Set(ids || []);
        const removing = metrics.filter((m) => idSet.has(m.id));
        removing.forEach((m) => removeMetricFromSemanticBridge(m));
        metrics = metrics.filter((m) => !idSet.has(m.id));
        writeMetrics(metrics);
        renderMetricTable();
        setTip(`已删除 ${removing.length} 条指标`);
      },
      setDomainFilter(value) {
        domainFilter = value || "";
        renderMetricTable();
      },
    };
  }

  global.MetricModule = {
    mount,
    parseFormulaFields,
    validateMetricAgainstModel,
    META_FIELDS,
    readMetrics,
    upsertAtomicFromDict,
    listBusinessModels: getAllBusinessModels,
  };
})(window);
