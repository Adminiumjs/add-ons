/**
 * THE SAMPLE: what a fresh install can add with no app beside it.
 *
 * Two drafts, in all eight languages: a "Newsletter sign-up" form that keeps
 * its answers only and asks for the newsletter with a tick the visitor
 * confirms by e-mail, and an anonymous "Quick feedback" survey with an open
 * link. No answer is made up. A sample is never live: a form goes live only
 * when its owner publishes it, with the privacy notice set, so adding sample
 * data never puts a page in front of a stranger.
 *
 * Anything that names an app's table — a form whose answers become an
 * enquiry, a survey sent after a job — is the app's own sample, not this one.
 *
 * `scripts/sample.mjs` writes this to `seeds/forms.sample.json`;
 * `sample.test.ts` fails when the file is behind, and parses every form.
 */
export type Row = Record<string, unknown>;
export interface Bundle {
  format: 'adminium.sample/1';
  app: 'forms';
  tables: { ref: string; onlyIfEmpty?: true; rows: Row[] }[];
}

const LANGUAGES = ['en-US', 'de-DE', 'fr-FR', 'cs-CZ', 'da-DK', 'ar-EG', 'zh-CN', 'zh-TW'] as const;
type Words = Record<(typeof LANGUAGES)[number], string>;
const w = (en: string, de: string, fr: string, cs: string, da: string, ar: string, zhCN: string, zhTW: string): Words => ({ 'en-US': en, 'de-DE': de, 'fr-FR': fr, 'cs-CZ': cs, 'da-DK': da, 'ar-EG': ar, 'zh-CN': zhCN, 'zh-TW': zhTW });

const NEWSLETTER = {
  v: 1,
  kind: 'form',
  languages: [...LANGUAGES],
  defaultLanguage: 'en-US',
  title: w('Newsletter sign-up', 'Newsletter abonnieren', 'Inscription à la lettre d’information', 'Přihlášení k odběru novinek', 'Tilmelding til nyhedsbrev', 'الاشتراك في النشرة الإخبارية', '订阅新闻简报', '訂閱電子報'),
  intro: w(
    'Get our news by e-mail, about once a month.',
    'Erhalten Sie unsere Neuigkeiten per E-Mail, etwa einmal im Monat.',
    'Recevez nos nouvelles par e-mail, environ une fois par mois.',
    'Dostávejte naše novinky e-mailem, zhruba jednou za měsíc.',
    'Få vores nyheder på e-mail, cirka en gang om måneden.',
    'تصلك أخبارنا بالبريد الإلكتروني، مرة في الشهر تقريبًا.',
    '通过电子邮件接收我们的新闻，大约每月一次。',
    '透過電子郵件接收我們的消息，大約每月一次。',
  ),
  questions: [
    { id: 'qname', kind: 'short', role: 'name', required: true, label: w('Your name', 'Ihr Name', 'Votre nom', 'Vaše jméno', 'Dit navn', 'اسمك', '您的姓名', '您的姓名') },
    { id: 'qemail', kind: 'short', check: 'email', role: 'email', required: true, maxLength: 320, label: w('Your e-mail', 'Ihre E-Mail-Adresse', 'Votre e-mail', 'Váš e-mail', 'Din e-mail', 'بريدك الإلكتروني', '您的电子邮件', '您的電子郵件') },
    {
      id: 'qnews',
      kind: 'tick',
      purpose: 'newsletter',
      confirm: true,
      wordingVersion: 1,
      wordingChangedAt: '2026-11-01',
      label: w(
        'Yes, send me the newsletter by e-mail. I can stop it at any time with the link in each mail.',
        'Ja, senden Sie mir den Newsletter per E-Mail. Ich kann ihn jederzeit über den Link in jeder E-Mail abbestellen.',
        'Oui, envoyez-moi la lettre d’information par e-mail. Je peux l’arrêter à tout moment avec le lien de chaque e-mail.',
        'Ano, posílejte mi novinky e-mailem. Odběr mohu kdykoli zrušit odkazem v každém e-mailu.',
        'Ja, send mig nyhedsbrevet på e-mail. Jeg kan stoppe det når som helst med linket i hver mail.',
        'نعم، أرسلوا لي النشرة الإخبارية بالبريد الإلكتروني. يمكنني إيقافها في أي وقت عبر الرابط في كل رسالة.',
        '是的，请通过电子邮件向我发送新闻简报。我可以随时通过每封邮件中的链接停止订阅。',
        '是的，請透過電子郵件寄送電子報給我。我可以隨時透過每封郵件中的連結停止訂閱。',
      ),
    },
  ],
  ending: {
    kind: 'words',
    words: w(
      'Thank you. Please check your inbox and confirm with the link we sent.',
      'Vielen Dank. Bitte sehen Sie in Ihrem Postfach nach und bestätigen Sie über den Link, den wir gesendet haben.',
      'Merci. Consultez votre boîte de réception et confirmez avec le lien que nous avons envoyé.',
      'Děkujeme. Podívejte se prosím do schránky a potvrďte odběr odkazem, který jsme poslali.',
      'Tak. Se i din indbakke, og bekræft med linket, vi har sendt.',
      'شكرًا لك. يُرجى التحقق من بريدك الوارد والتأكيد عبر الرابط الذي أرسلناه.',
      '谢谢。请查看您的收件箱，并通过我们发送的链接确认。',
      '謝謝。請查看您的收件匣，並透過我們寄出的連結確認。',
    ),
  },
};

const FEEDBACK = {
  v: 1,
  kind: 'survey',
  languages: [...LANGUAGES],
  defaultLanguage: 'en-US',
  title: w('Quick feedback', 'Kurzes Feedback', 'Avis rapide', 'Rychlá zpětná vazba', 'Hurtig feedback', 'رأي سريع', '快速反馈', '快速意見回饋'),
  questions: [
    {
      id: 'qscore',
      kind: 'score',
      recommend: true,
      required: true,
      label: w(
        'How likely are you to recommend us to a friend?',
        'Wie wahrscheinlich ist es, dass Sie uns einem Freund empfehlen?',
        'Quelle est la probabilité que vous nous recommandiez à un ami ?',
        'Jak pravděpodobné je, že nás doporučíte příteli?',
        'Hvor sandsynligt er det, at du vil anbefale os til en ven?',
        'ما مدى احتمال أن توصي بنا لصديق؟',
        '您向朋友推荐我们的可能性有多大？',
        '您向朋友推薦我們的可能性有多大？',
      ),
    },
    {
      id: 'qmore',
      kind: 'long',
      label: w('Anything we could do better?', 'Was könnten wir besser machen?', 'Que pourrions-nous mieux faire ?', 'Co bychom mohli dělat lépe?', 'Er der noget, vi kunne gøre bedre?', 'هل هناك ما يمكننا تحسينه؟', '我们有哪些地方可以做得更好？', '我們有哪些地方可以做得更好？'),
    },
  ],
  ending: {
    kind: 'words',
    words: w('Thank you. Your answers help us.', 'Vielen Dank. Ihre Antworten helfen uns.', 'Merci. Vos réponses nous aident.', 'Děkujeme. Vaše odpovědi nám pomáhají.', 'Tak. Dine svar hjælper os.', 'شكرًا لك. إجاباتك تساعدنا.', '谢谢，您的回答对我们很有帮助。', '謝謝，您的回答對我們很有幫助。'),
  },
};

const LIMITS = { perHour: 200, harder: false };

export function buildSample(): Bundle {
  return {
    format: 'adminium.sample/1',
    app: 'forms',
    tables: [
      {
        ref: 'forms',
        rows: [
          // Each with its own key: nothing fills the forms table's text key on a row the loader writes.
          { '@label': 'form:newsletter', id: '6f1c2b0e-4d5a-4c7e-9b1f-0a3d5e7c9b21', name: NEWSLETTER.title['en-US'], slug: 'newsletter-sign-up', kind: 'form', state: 'draft', definition: NEWSLETTER, settings: { becomes: null, tell: [], limits: LIMITS } },
          { '@label': 'form:feedback', id: 'b84e9a37-2c61-4f0d-8e5a-7d9c1b3f6a40', name: FEEDBACK.title['en-US'], slug: 'quick-feedback', kind: 'survey', state: 'draft', definition: FEEDBACK, settings: { becomes: null, tell: [], limits: LIMITS, survey: { mode: 'anonymous', linkNames: false, stopAfterDays: 30 } } },
        ],
      },
    ],
  };
}
