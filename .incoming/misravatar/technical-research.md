# حقائق تقنية موثقة للتوسعة التعليمية

تمت مراجعة المصادر الرسمية في 25 أكتوبر 2026؛ لا تعني هذه الملاحظات أن التكامل قد نُفّذ أو أن حساب Qwen أُعدّ.

## Qwen والمحادثة والصوت

- واجهة محادثة Qwen متوافقة مع OpenAI عبر `POST /compatible-mode/v1/chat/completions`، مع مصادقة Bearer. توصي وثائق Model Studio بنطاقات Workspace إقليمية، وتقول إن نطاقات DashScope السابقة تظل تعمل. يلزم استخدام مفتاح المنطقة المطابق للنطاق. [وثيقة المحادثة](https://www.alibabacloud.com/help/en/model-studio/qwen-api-via-openai-chat-completions)
- التوليد الصوتي اللحظي في Qwen Audio TTS يدعم بث مقاطع نصية ومقاطع صوتية، ويمكن ضبط اللغة والصوت والتعليمات واللهجة ضمن حدود النموذج والصوت. [دليل TTS اللحظي](https://www.alibabacloud.com/help/en/model-studio/realtime-tts-user-guide) [أحداث عميل TTS](https://www.alibabacloud.com/help/en/model-studio/qwen-audio-tts-client-events)
- توثيق Qwen Audio TTS يضم `ar` ضمن رموز اللغات، ويذكر العربية ضمن اللغات المتاحة للأصوات المستنسخة. لا يضمن ذلك وجود صوت نظام مصري جاهز؛ اللهجة والصوت المحددان يعتمدان على نموذج/صوت متوافقين، وقد يلزم صوت مرجعي مرخّص. [نظرة عامة على أصوات TTS](https://www.alibabacloud.com/help/en/model-studio/tts-model) [متطلبات استنساخ الصوت](https://www.alibabacloud.com/help/en/model-studio/voice-cloning-user-guide)
- واجهة HTTP تستطيع إعادة أحداث SSE لقطع الصوت، لكن توثيق Qwen يربط بعض مسارات TTS بعنوان Workspace الإقليمي. [واجهة HTTP لـ Qwen Audio TTS](https://www.alibabacloud.com/help/en/model-studio/qwen-audio-tts-http-api)

## الرؤية المحلية في المتصفح

- Face Landmarker يعيد معالم الوجه ودرجات blendshapes ومصفوفة تحويل؛ يمكن استخدام هذه الإشارات لتقدير تعابير مرئية، لا لتشخيص الحالة النفسية. عمليات `detectForVideo` متزامنة وقد تحجب واجهة المستخدم، لذلك ينبغي نقل الاستدلال إلى Worker. [دليل Face Landmarker للويب](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker/web_js)
- Hand Landmarker يعيد 21 نقطة لكل يد في الإحداثيات الطبيعية والعالمية، ما يسمح بتصميم إيماءات محددة مثل الإشارة والسحب. [دليل Hand Landmarker للويب](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker/web_js)
- Pose Landmarker يعيد 33 نقطة للجسم في إحداثيات الصورة والعالم، ويمكن استخدامها لتقدير وضعية عامة مثل الميل للأمام أو الابتعاد عن الكاميرا. [دليل Pose Landmarker للويب](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js)
- هذه النماذج تكشف معالم الوجه والجسم، لكنها لا تعطي نقطة نظر دقيقة على الشاشة ولا هوية شخص؛ يجب وصف النظر بأنه تقدير تقريبي، وجعل أي مطابقة هوية اختيارية محلية مع موافقة صريحة وحذف سهل.

## أصول الشخصية الحالية

- `public/hero-citizen-active.glb` يحتوي الهيكل الأصلي (41 مفصلًا) وحركة `idle` واحدة. لا توجد blendshapes أو مفاصل `jaw`/`mouth` مسماة.
- `public/egyptian-fez-head.glb` مجسم رأس منفصل ثابت بلا هيكل أو تعابير morph targets. لذلك لا يمكن ادعاء مزامنة شفاه/visemes حقيقية بالمجسم الحالي؛ يلزم أصل وجه جديد بتركيب فم قابل للتحريك أو تصميم متفق عليه، مع بقاء الجسم والهيكل القديمين محفوظين.
