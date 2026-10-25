// ═══════════════════════════════════════════════
//  curriculum.js — منهج بايثون التعليمي + ردود مستر نقراشي
//  (إضافة على الهيكل الأساسي: بيفصل المحتوى التعليمي عن المايسترو app.js)
// ═══════════════════════════════════════════════

export const GREETINGS = [
  'أهلاً أهلاً يا بطل! أنا مستر نقراشي، ومعايا هنتعلم بايثون خطوة بخطوة.',
];

export const PRAISE = [
  'برافو عليك! الكود اشتغل زي ما المفروض.',
  'ممتاز! إنت بتتقدم بسرعة.',
  'عاش يا بطل! كده الدرس خلص.',
];

export const RETRY = [
  'قريب جداً! الكود اشتغل، بس الناتج مش هو المطلوب. اقرأ المطلوب تاني وجرّب.',
  'مش بعيد. راجع التمرين وحاول تاني، وأنا معاك.',
];

export const LESSONS = [
  {
    id: 'print',
    title: '١ · الطباعة',
    intro: [
      'يلا بينا نبدأ أول درس. الأمر print هو اللي بيخلّي بايثون يكتب على الشاشة.',
      'بتكتب print وبعدها قوسين، وجواهم الكلام اللي عايزه بين علامتين تنصيص.',
      'جرّب المثال اللي في المحرر واضغط شغّل.',
    ],
    example: 'print("أهلاً بيك في عالم بايثون")',
    task: 'خلّي بايثون تطبع اسمك.',
    starter: '# اكتب اسمك جوه print\n',
    hint: 'اكتب print وبعدها قوسين، وجواهم اسمك بين علامتين تنصيص، زي print("زياد").',
    solution: 'print("زياد")',
    check: (code, out) => /print\s*\(/.test(code) && out.trim().length > 0,
  },
  {
    id: 'variables',
    title: '٢ · المتغيرات',
    intro: [
      'المتغير زي علبة بتحط فيها قيمة وتديها اسم.',
      'مثلاً age يساوي خمستاشر. وبعد كده نقدر نطبعه أو نستخدمه في أي وقت.',
    ],
    example: 'age = 15\nprint(age)',
    task: 'اعمل متغير اسمه name فيه اسمك، واطبعه.',
    starter: '# عرّف المتغير name هنا\n',
    hint: 'اكتب name يساوي اسمك بين تنصيص، وبعدها print(name).',
    solution: 'name = "زياد"\nprint(name)',
    check: (code, out) => /\bname\s*=/.test(code) && out.trim().length > 0,
  },
  {
    id: 'if',
    title: '٣ · الشرط if',
    intro: [
      'الشرط if بيخلّي البرنامج ياخد قرار. لو الشرط صح بينفّذ كود، وإلا بينفّذ كود تاني.',
      'خلي بالك من المسافة اللي قبل السطر اللي جوه if. دي اسمها indentation، وبايثون بيعتمد عليها.',
    ],
    example: 'age = 20\nif age >= 18:\n    print("مسموح")\nelse:\n    print("ممنوع")',
    task: 'غيّر قيمة age لاتناشر، وخلّي الناتج يبقى ممنوع.',
    starter: 'age = 20\nif age >= 18:\n    print("مسموح")\nelse:\n    print("ممنوع")',
    hint: 'غيّر الرقم في أول سطر من 20 لـ 12.',
    solution: 'age = 12\nif age >= 18:\n    print("مسموح")\nelse:\n    print("ممنوع")',
    check: (code, out) => out.trim() === 'ممنوع' && /\bif\b/.test(code) && /\belse\b/.test(code),
  },
  {
    id: 'loops',
    title: '٤ · التكرار for',
    intro: [
      'اللوب for بيكرر كود كذا مرة من غير ما تكتبه كذا مرة.',
      'range خمسة بيدّيك الأرقام من صفر لحد أربعة. لاحظ إن العدّ في بايثون بيبدأ من صفر.',
    ],
    example: 'for i in range(5):\n    print(i)',
    task: 'اطبع الأرقام من واحد لحد خمسة.',
    starter: '# اطبع من 1 لـ 5\n',
    hint: 'range بياخد بداية ونهاية. النهاية مش داخلة في العدّ، فاستخدم range(1, 6).',
    solution: 'for i in range(1, 6):\n    print(i)',
    check: (code, out) => out.trim().split(/\s+/).join(',') === '1,2,3,4,5' && /\bfor\b/.test(code),
  },
  {
    id: 'functions',
    title: '٥ · الدوال',
    intro: [
      'الدالة هي مجموعة أوامر ليها اسم، تكتبها مرة وتستخدمها كذا مرة.',
      'بنعرّفها بكلمة def، وبترجّع النتيجة بكلمة return.',
    ],
    example: 'def greet(name):\n    return "أهلاً " + name\n\nprint(greet("يا بطل"))',
    task: 'اكتب دالة اسمها square ترجّع الرقم مضروب في نفسه، واطبع square(4).',
    starter: '# عرّف الدالة square هنا\n',
    hint: 'def square(n): وتحتها بمسافة return n * n. وبعدها print(square(4)).',
    solution: 'def square(n):\n    return n * n\n\nprint(square(4))',
    check: (code, out) => /def\s+square\s*\(/.test(code) && out.trim() === '16',
  },
  {
    id: 'lists',
    title: '٦ · القوائم',
    intro: [
      'القائمة list بتخزّن كذا قيمة مع بعض بين أقواس مربعة.',
      'وبـ len بنعرف عددهم، وبرقم الموضع بنوصل لأي عنصر، وأول عنصر رقمه صفر.',
    ],
    example: 'fruits = ["تفاح", "موز", "برتقال"]\nprint(fruits[0])\nprint(len(fruits))',
    task: 'اعمل قائمة اسمها numbers فيها الأرقام 1 و2 و3 و4، واطبع مجموعها باستخدام sum.',
    starter: '# اعمل القائمة numbers هنا\n',
    hint: 'numbers = [1, 2, 3, 4] وبعدها print(sum(numbers)).',
    solution: 'numbers = [1, 2, 3, 4]\nprint(sum(numbers))',
    check: (code, out) => /numbers\s*=\s*\[/.test(code) && /sum\s*\(/.test(code) && out.trim() === '10',
  },
  {
    id: 'while',
    title: '٧ · التكرار while',
    intro: [
      'اللوب while بيكرر الكود طول ما الشرط صح، ويقف أول ما الشرط يبقى غلط.',
      'خلي بالك: لازم تغيّر قيمة المتغير جوه اللوب، وإلا هيفضل يلف للأبد.',
    ],
    example: 'count = 1\nwhile count <= 3:\n    print(count)\n    count = count + 1',
    task: 'اطبع العد التنازلي 3 ثم 2 ثم 1 باستخدام while.',
    starter: '# ابدأ من 3 وانزل لحد 1\n',
    hint: 'ابدأ بـ n = 3، واكتب while n >= 1: وجواها print(n) وبعدها n = n - 1.',
    solution: 'n = 3\nwhile n >= 1:\n    print(n)\n    n = n - 1',
    check: (code, out) => out.trim().split(/\s+/).join(',') === '3,2,1' && /\bwhile\b/.test(code),
  },
  {
    id: 'dict',
    title: '٨ · القواميس',
    intro: [
      'القاموس dict بيخزّن البيانات في أزواج: مفتاح وقيمة، زي بطاقة فيها اسم وسن.',
      'بنكتبه بين أقواس معقوصة، وبنوصل للقيمة بالمفتاح بتاعها.',
    ],
    example: 'student = {"name": "علي", "age": 14}\nprint(student["name"])\nstudent["age"] = 15\nprint(student["age"])',
    task: 'اعمل قاموس اسمه car فيه brand بقيمة "Fiat" و year بقيمة 2020، واطبع الـ brand.',
    starter: '# اعمل القاموس car هنا\n',
    hint: 'car = {"brand": "Fiat", "year": 2020} وبعدها print(car["brand"]).',
    solution: 'car = {"brand": "Fiat", "year": 2020}\nprint(car["brand"])',
    check: (code, out) => /\bcar\s*=\s*\{/.test(code) && out.trim() === 'Fiat',
  },
  {
    id: 'strings',
    title: '٩ · النصوص',
    intro: [
      'النص string ليه أدوات جاهزة. upper بتكبّر الحروف، و len بتعدّ الحروف.',
      'وكمان نقدر نوصل لأي حرف برقمه، وأول حرف رقمه صفر.',
    ],
    example: 'word = "python"\nprint(word.upper())\nprint(len(word))\nprint(word[0])',
    task: 'عرّف word بقيمة "hello" واطبع الكلمة بحروف كبيرة، وبعدها عدد حروفها.',
    starter: '# عرّف word هنا\n',
    hint: 'word = "hello" ثم print(word.upper()) ثم print(len(word)).',
    solution: 'word = "hello"\nprint(word.upper())\nprint(len(word))',
    check: (code, out) => out.trim().split(/\s+/).join(',') === 'HELLO,5' && /upper\s*\(/.test(code) && /len\s*\(/.test(code),
  },
  {
    id: 'forlist',
    title: '١٠ · اللوب على قائمة',
    intro: [
      'تعالى نجمع اللي اتعلمناه. نقدر نستخدم for عشان نمشي على عناصر القائمة واحد واحد.',
      'مش محتاج تحسب الأرقام بنفسك. بايثون بيديك كل عنصر بدوره، وإنت اللي بتسمّيه.',
    ],
    example: 'fruits = ["تفاح", "موز", "برتقال"]\nfor fruit in fruits:\n    print(fruit)',
    task: 'عندك قائمة prices فيها 10 و20 و30. اطبع كل سعر مضروب في اتنين.',
    starter: 'prices = [10, 20, 30]\n# اطبع كل سعر مضروب في 2\n',
    hint: 'اكتب for price in prices: وجواها بمسافة print(price * 2).',
    solution: 'prices = [10, 20, 30]\nfor price in prices:\n    print(price * 2)',
    check: (code, out) => out.trim().split(/\s+/).join(',') === '20,40,60' && /\bfor\b/.test(code) && /\bin\s+prices\b/.test(code),
  },
  {
    id: 'evenfn',
    title: '١١ · دالة بشرط',
    intro: [
      'دلوقتي هنكتب دالة بترجّع صح أو غلط حسب الرقم.',
      'العلامة النسبة المئوية في بايثون بتديك باقي القسمة. لو باقي قسمة الرقم على اتنين صفر، يبقى الرقم زوجي.',
    ],
    example: 'def is_even(n):\n    return n % 2 == 0\n\nprint(is_even(4))\nprint(is_even(7))',
    task: 'اكتب دالة اسمها is_odd ترجّع True لو الرقم فردي. واطبع is_odd(7) وبعدها is_odd(10).',
    starter: '# عرّف الدالة is_odd هنا\n',
    hint: 'الرقم الفردي باقي قسمته على اتنين بيبقى واحد. اكتب return n % 2 == 1.',
    solution: 'def is_odd(n):\n    return n % 2 == 1\n\nprint(is_odd(7))\nprint(is_odd(10))',
    check: (code, out) => /def\s+is_odd\s*\(/.test(code) && out.trim().split(/\s+/).join(',') === 'True,False',
  },
  {
    id: 'fizzbuzz',
    title: '١٢ · تحدي FizzBuzz',
    intro: [
      'ده التحدي الأخير، وبيجمع اللوب والشرط وباقي القسمة.',
      'هتعدّ من واحد لحد خمستاشر. لو الرقم بيقبل القسمة على تلاتة اطبع Fizz، ولو على خمسة اطبع Buzz، ولو على الاتنين مع بعض اطبع FizzBuzz، وغير كده اطبع الرقم نفسه.',
      'اتفرّج على المثال الأول، وبعدها هيبقى دورك.',
    ],
    example: 'for i in range(1, 6):\n    if i % 2 == 0:\n        print("زوجي")\n    else:\n        print(i)',
    task: 'اكتب FizzBuzz من 1 لحد 15 زي ما شرحت.',
    starter: '# FizzBuzz من 1 لـ 15\n',
    hint: 'ابدأ بشرط القسمة على 15 الأول: if i % 15 == 0. وبعدها elif للتلاتة، وelif للخمسة، وآخرها else يطبع الرقم.',
    solution: 'for i in range(1, 16):\n    if i % 15 == 0:\n        print("FizzBuzz")\n    elif i % 3 == 0:\n        print("Fizz")\n    elif i % 5 == 0:\n        print("Buzz")\n    else:\n        print(i)',
    check: (code, out) =>
      out.trim().split(/\s+/).join(',') === '1,2,Fizz,4,Buzz,Fizz,7,8,Fizz,Buzz,11,Fizz,13,14,FizzBuzz' && /\bfor\b/.test(code) && /%/.test(code),
  },
];

// ─────────────────────────────────────────────
//  شرح الكود سطر سطر + سؤال اختيار بعد كل درس
//  lines: أرقام الأسطر (من 1) اللي بتتنوّر على شاشة الهولوجرام أثناء الشرح
// ─────────────────────────────────────────────
const EXTRAS = {
  print: {
    steps: [
      { lines: [1], say: 'print هو الأمر اللي بيطبع على الشاشة. وبعده قوسين.' },
      { lines: [1], say: 'الكلام اللي بين علامتي التنصيص اسمه نص، وبايثون بيطبعه زي ما هو.' },
    ],
    quiz: { q: 'إيه الأمر اللي بيطبع كلام على الشاشة في بايثون؟', options: ['show', 'print', 'write'], answer: 1, why: 'الأمر هو print، وبنحط الكلام جواه بين قوسين.' },
  },
  variables: {
    steps: [
      { lines: [1], say: 'هنا عملنا متغير اسمه age وحطينا فيه الرقم خمستاشر. علامة يساوي معناها خزّن.' },
      { lines: [2], say: 'وهنا طبعنا قيمة المتغير، فهيظهر خمستاشر.' },
    ],
    quiz: { q: 'بعد السطر x = 5 ثم x = x + 1، إيه قيمة x؟', options: ['5', '6', '1'], answer: 1, why: 'x كانت 5، وبعدين زوّدنا عليها واحد فبقت 6.' },
  },
  if: {
    steps: [
      { lines: [1], say: 'بنخزّن العمر في المتغير age.' },
      { lines: [2], say: 'السطر ده بيسأل: هل العمر أكبر من أو يساوي ثمانية عشر؟ ولاحظ علامة النقطتين في الآخر.' },
      { lines: [3], say: 'لو الإجابة آه، بينفّذ السطر اللي متحرك لجوه، وهو يطبع مسموح.' },
      { lines: [4, 5], say: 'ولو لأ، بينفّذ else ويطبع ممنوع.' },
    ],
    quiz: { q: 'لو age = 12 في المثال، إيه اللي هيتطبع؟', options: ['مسموح', 'ممنوع', 'مفيش حاجة'], answer: 1, why: 'اتناشر أقل من ثمانية عشر، فالشرط غلط وبينفّذ else.' },
  },
  loops: {
    steps: [
      { lines: [1], say: 'for بتلف على الأرقام اللي طالعة من range خمسة، يعني من صفر لحد أربعة.' },
      { lines: [2], say: 'وكل لفة بتطبع الرقم الحالي i.' },
    ],
    quiz: { q: 'range(3) بيدّي أنهي أرقام؟', options: ['1، 2، 3', '0، 1، 2', '0، 1، 2، 3'], answer: 1, why: 'العدّ بيبدأ من صفر وبيقف قبل الرقم اللي كتبته.' },
  },
  functions: {
    steps: [
      { lines: [1], say: 'def بتعرّف دالة جديدة اسمها greet، وبتاخد قيمة اسمها name.' },
      { lines: [2], say: 'return بترجّع النتيجة لمكان ما اتنادت منه الدالة.' },
      { lines: [4], say: 'وهنا ناديت الدالة وطبعت اللي رجّعته.' },
    ],
    quiz: { q: 'إيه الكلمة اللي بنعرّف بيها دالة؟', options: ['func', 'def', 'function'], answer: 1, why: 'بايثون بتستخدم def.' },
  },
  lists: {
    steps: [
      { lines: [1], say: 'عملنا قائمة فيها تلات فواكه بين أقواس مربعة.' },
      { lines: [2], say: 'fruits صفر بتجيب أول عنصر، وهو التفاح.' },
      { lines: [3], say: 'و len بتقولك عدد العناصر، وهو تلاتة.' },
    ],
    quiz: { q: 'لو nums = [10, 20, 30]، إيه قيمة nums[1]؟', options: ['10', '20', '30'], answer: 1, why: 'الرقم واحد هو العنصر التاني، لأن العدّ بيبدأ من صفر.' },
  },
  while: {
    steps: [
      { lines: [1], say: 'بنبدأ العداد count بواحد.' },
      { lines: [2], say: 'while بتكرر طول ما count أصغر من أو يساوي تلاتة.' },
      { lines: [3], say: 'كل لفة بنطبع العداد.' },
      { lines: [4], say: 'وبنزوّده واحد، وده اللي بيخلّي اللوب يقف في الآخر.' },
    ],
    quiz: { q: 'إيه اللي بيحصل لو نسينا نغيّر المتغير جوه while؟', options: ['بيقف على طول', 'بيلف للأبد', 'بيطبع خطأ'], answer: 1, why: 'الشرط هيفضل صح على طول، فاللوب مبيقفش.' },
  },
  dict: {
    steps: [
      { lines: [1], say: 'عملنا قاموس فيه مفتاحين: name بقيمة علي، و age بقيمة أربعتاشر.' },
      { lines: [2], say: 'بنجيب القيمة بالمفتاح بتاعها بين أقواس مربعة.' },
      { lines: [3], say: 'وهنا غيّرنا قيمة age لخمستاشر.' },
      { lines: [4], say: 'ولما طبعناها طلعت القيمة الجديدة.' },
    ],
    quiz: { q: 'القاموس بيخزّن البيانات على شكل إيه؟', options: ['مفتاح وقيمة', 'أرقام بس', 'حروف بس'], answer: 0, why: 'كل عنصر فيه مفتاح بنوصل بيه للقيمة.' },
  },
  strings: {
    steps: [
      { lines: [1], say: 'خزّنا كلمة python في المتغير word.' },
      { lines: [2], say: 'upper بترجّع الكلمة بحروف كبيرة.' },
      { lines: [3], say: 'len بتعدّ الحروف، وهنا النتيجة ستة.' },
      { lines: [4], say: 'ورقم صفر بيجيب أول حرف، وهو p.' },
    ],
    quiz: { q: 'إيه ناتج len("code")؟', options: ['3', '4', '5'], answer: 1, why: 'كلمة code فيها أربع حروف.' },
  },
  forlist: {
    steps: [
      { lines: [1], say: 'عملنا قائمة فيها تلات فواكه.' },
      { lines: [2], say: 'for بتاخد عنصر عنصر من القائمة وتحطه في المتغير fruit، وكل لفة بتاخد عنصر جديد.' },
      { lines: [3], say: 'وجوه اللوب بنطبع العنصر الحالي. لاحظ المسافة اللي قبل print.' },
    ],
    quiz: { q: 'إيه اللي بيتطبع من الكود for x in [4, 5, 6]: print(x)؟', options: ['4 ثم 5 ثم 6', 'x تلات مرات', '0 ثم 1 ثم 2'], answer: 0, why: 'x بياخد كل عنصر بدوره: أربعة وبعدها خمسة وبعدها ستة.' },
  },
  evenfn: {
    steps: [
      { lines: [1], say: 'عرّفنا دالة اسمها is_even بتاخد رقم n.' },
      { lines: [2], say: 'n % 2 بتديك باقي القسمة على اتنين. لو بيساوي صفر يبقى الرقم زوجي والدالة بترجّع True، وإلا بترجّع False.' },
      { lines: [4], say: 'ناديناها على أربعة، فرجعت True.' },
      { lines: [5], say: 'وعلى سبعة، فرجعت False.' },
    ],
    quiz: { q: 'إيه ناتج 9 % 2؟', options: ['0', '1', '4'], answer: 1, why: 'تسعة مقسومة على اتنين بتدّي أربعة والباقي واحد.' },
  },
  fizzbuzz: {
    steps: [
      { lines: [1], say: 'لوب بيعدّ من واحد لحد خمسة.' },
      { lines: [2], say: 'السطر ده بيسأل: هل باقي قسمة الرقم على اتنين بيساوي صفر؟' },
      { lines: [3], say: 'لو آه بنطبع كلمة زوجي.' },
      { lines: [4, 5], say: 'ولو لأ بنطبع الرقم نفسه. نفس الفكرة هتستخدمها في التحدي، بس بشروط أكتر.' },
    ],
    quiz: { q: 'ليه بنختبر شرط القسمة على 15 الأول في FizzBuzz؟', options: ['لأنه لو بدأنا بالتلاتة هيمسك الرقم 15 غلط', 'لأن 15 أكبر رقم', 'مفيش فرق في الترتيب'], answer: 0, why: 'elif بيقف عند أول شرط صح، فلازم الشرط الأكبر ييجي الأول.' },
  },
};
for (const L of LESSONS) Object.assign(L, EXTRAS[L.id] || {});

// أسئلة عامة بيرد عليها مستر نقراشي من غير باك إند
const FAQ = [
  { keys: ['ايه هو بايثون', 'يعني ايه بايثون', 'بايثون ايه', 'what is python'],
    answer: 'بايثون لغة برمجة سهلة وقوية، بتُستخدم في المواقع والذكاء الاصطناعي وتحليل البيانات والألعاب. وكتابتها قريبة من الإنجليزي.' },
  { keys: ['متغير', 'variable'],
    answer: 'المتغير علبة بتخزّن فيها قيمة وتديها اسم، زي age يساوي خمستاشر. وتقدر تغيّر القيمة بعدين.' },
  { keys: ['لوب', 'حلقه', 'تكرار', 'for', 'while'],
    answer: 'اللوب بيكرر كود كذا مرة. for بيمشي على مجموعة قيم، و while بيكرر طول ما الشرط صح.' },
  { keys: ['دال', 'function', 'def'],
    answer: 'الدالة مجموعة أوامر ليها اسم. بتعرّفها بـ def وتناديها باسمها كل ما تحتاجها، وممكن ترجّع قيمة بـ return.' },
  { keys: ['قايم', 'list', 'مصفوف'],
    answer: 'القائمة بتخزن قيم كتير مع بعض، زي numbers يساوي قوس مربع فيه 1 و2 و3. وبنوصل لعنصر برقمه وأول رقم صفر.' },
  { keys: ['شرط', 'if', 'else'],
    answer: 'if بتختبر شرط. لو صح بتنفّذ الكود اللي تحتها، ولو غلط بتنفّذ else لو موجودة.' },
  { keys: ['indent', 'مسافه', 'مسافات'],
    answer: 'المسافة اللي في بداية السطر بتقول لبايثون إن السطر ده تابع للـ if أو اللوب أو الدالة اللي فوقه. المعتاد أربع مسافات.' },
  { keys: ['باقي القسمه', 'باقي القسمة', 'modulo'],
    answer: 'العلامة % بتديك باقي القسمة. مثلاً 9 % 2 بتساوي 1. ولو الباقي صفر يبقى الرقم بيقبل القسمة بالظبط، وبنستخدمها نعرف الزوجي والفردي.' },
  { keys: ['fizzbuzz', 'فيزباز'],
    answer: 'FizzBuzz تحدي مشهور: بتعدّ من واحد، وتطبع Fizz لمضاعفات التلاتة، وBuzz لمضاعفات الخمسة، وFizzBuzz لو الاتنين. ابدأ بشرط الخمستاشر الأول.' },
  { keys: ['شكرا', 'تسلم', 'thanks'],
    answer: 'العفو يا بطل! ده شغلي ومتعتي. كمّل وإنت هتبقى مبرمج شاطر.' },
  { keys: ['انت مين', 'اسمك', 'مين انت'],
    answer: 'أنا مستر نقراشي، معلم البرمجة الهولوجرام. لابس طربوش عشان الشياكة، وبعلّم بايثون.' },
];

const ERRORS = [
  [/IndentationError|unexpected indent|expected an indented block/i, 'المسافات اللي قبل السطر مش مظبوطة. السطر اللي جوه if أو for أو def لازم يتحرك أربع مسافات لجوه.'],
  [/SyntaxError|invalid syntax|EOL while|unterminated/i, 'فيه غلطة في كتابة الكود. راجع الأقواس وعلامات التنصيص وعلامة النقطتين بعد if وfor وdef.'],
  [/NameError/i, 'بايثون مش عارف الاسم ده. اتأكد إنك عرّفته قبل ما تستخدمه، وإنك كاتبه بنفس الحروف بالظبط.'],
  [/TypeError/i, 'بتحاول تستخدم نوعين مش متوافقين، زي جمع رقم مع نص. حوّلهم لنفس النوع.'],
  [/ZeroDivisionError/i, 'مينفعش نقسم على صفر.'],
  [/IndexError/i, 'بتطلب عنصر رقمه أكبر من حجم القائمة. فكّر إن العدّ بيبدأ من صفر.'],
];

export function explainError(text) {
  for (const [re, msg] of ERRORS) if (re.test(text)) return msg;
  return 'فيه خطأ في الكود. اقرأ آخر سطر في الناتج، هو اللي بيقولك المشكلة فين.';
}

// تطبيع النص العربي للمقارنة (شيل التشكيل ووحّد الحروف)
export function normalize(s) {
  return String(s)
    .toLowerCase()
    .replace(/[ً-ْٰـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[؟?!.,،]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function matchFaq(text) {
  const t = normalize(text);
  for (const f of FAQ) if (f.keys.some((k) => t.includes(normalize(k)))) return f.answer;
  return null;
}

// أوامر صوتية/كتابية: "الدرس اللي بعده"، "شغل الكود"...
export function matchCommand(text) {
  const t = normalize(text);
  const has = (...w) => w.some((x) => t.includes(x));
  if (has('الدرس الجاي', 'الدرس التالي', 'الدرس اللي بعده', 'الي بعده', 'التالي', 'كمل', 'next')) return 'next';
  if (has('اشرح الكود', 'اشرح المثال', 'اشرحلي الكود', 'شرح الكود', 'explain')) return 'explain';
  if (has('شهاده', 'شهادتي', 'certificate')) return 'certificate';
  if (has('الدرس السابق', 'الدرس اللي قبله', 'السابق', 'ارجع', 'previous')) return 'prev';
  if (has('شغل', 'نفذ', 'run')) return 'run';
  if (has('اعد', 'كرر', 'تاني', 'repeat')) return 'repeat';
  if (has('تلميح', 'ساعدني', 'hint')) return 'hint';
  if (has('الحل', 'solution')) return 'solution';
  return null;
}
