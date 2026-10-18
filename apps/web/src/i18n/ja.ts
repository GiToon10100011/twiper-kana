import type { ko } from './ko';

export const ja: typeof ko = {
  home: {
    lead: '本物のキーボードで身につける日本語フリック入力',
    tutorial: 'チュートリアル',
    tutorialHint: 'キーボードの準備・フリック・確定',
    tutorialFirst: 'はじめての方はここから',
    settings: '設定',
    devTools: '開発ツール',
    imeLab: 'IMEスパイク',
    imeLabHint: '入力の流れを確認',
    guideCheck: 'キーボードガイド確認',
    guideCheckHint: 'キー配置の照合',
  },
  onboarding: {
    step: '{{current}}/{{total}}',
    skip: 'スキップ',
    setup: {
      title: 'まずキーボードを準備しましょう',
      body: 'twiperでは画面上の偽物のキーボードではなく、いま使っているiPhoneの日本語キーボードで練習します。',
      add: '設定 › 一般 › キーボード › キーボード › 新しいキーボードを追加 › 日本語 から「かな」を追加します。',
      switch:
        '入力するときは地球儀キーで、あ・か・さのキーが並ぶ12キーのキーボードに切り替えます。',
      done: '準備できました',
    },
    flick: {
      title: 'フリックは押したまま滑らせる入力です',
      body: 'キーをタップすると中央の文字、押したまま上下左右に滑らせるとその方向の文字が入力されます。',
      rule: '「あ」キーひとつで あいうえお の5文字が打てます。か・さ・た…どのキーも同じルールです。',
      tap: 'タップ',
      left: '左',
      up: '上',
      right: '右',
      down: '下',
      tryIt: '実際に打ってみる',
    },
    try: {
      title: '「あ」キーで あいうえお を打ってみましょう',
      hint: 'タップ → 左 → 上 → 右 → 下 の順です。',
    },
    check: {
      title: '次は「か」キーで かきくけこ',
      hint: '同じ順に打って、確定を押してください。',
    },
    matched: '正解です。キーボード右下の「確定」キーを押すと次に進みます。',
    commitRule: '1行打ち終えたら「確定」キーを押して次の問題に進みます。',
    done: {
      title: '準備完了',
      body: 'フリックと確定をどちらも試しました。次は行ごとにキーの位置を覚えましょう。',
      start: '最初のレベルをはじめる',
      home: 'ホームへ',
    },
  },
  training: {
    tapInput: '入力欄をタップしてキーボードを開きます',
    romaji: 'ローマ字入力になっているようです。地球儀キーで「日本語かな」に切り替えてください。',
    toggle:
      '同じキーを何度もタップして入力しています。キーを押したまま、すべらせて打ってみましょう。',
  },
  course: {
    title: 'コース',
    level: 'Lv.{{number}}',
    row: '{{keys}}行',
    all: '五十音ランダム',
    allHint: '五十音 + 単語',
    locked: 'ロック中',
    best: 'ベスト {{accuracy}}%',
  },
  drill: {
    exit: 'やめる',
    intro: '1行5文字を{{count}}行打ちます。行を打ち終えて「確定」を押すと次の行に進みます。',
    introAll:
      '五十音の行と単語の行を交互に{{count}}行打ちます。行を打ち終えて「確定」を押すと次の行に進みます。',
    keyGuide: 'このレベルのキー',
    start: 'はじめる',
    progress: '{{current}}/{{total}}',
    extra: '間違えた文字の復習',
    matched: '正解です。「確定」を押すと次の行に進みます。',
    retryNote: '間違えた文字は数行あとにもう一度出ます。',
  },
  result: {
    title: '{{level}} 完了',
    accuracy: '一発正解率',
    speed: 'かな/分',
    time: '時間',
    minutes: '{{min}}分{{sec}}秒',
    seconds: '{{sec}}秒',
    missed: '間違えた文字',
    noMissed: '一度も間違えませんでした。',
    pass: '一発正解率が90%を超えました。次のレベルへ進みましょう。',
    practice: '一発正解率が90%を超えたら、次のレベルへ進むのがおすすめです。',
    romaji:
      'ローマ字入力で打った行がありました。フリックを身につけるには「日本語かな」で打ってください。',
    toggle:
      '同じキーの連打で打った行がありました。連打ではなく、キーを押したまますべらせて打ってみましょう。',
    again: 'もう一度',
    next: '次へ: {{level}}',
    home: 'ホームへ',
  },
  pwa: {
    update: '新しいバージョンがあります。',
    reload: '更新',
    offlineReady: 'オフラインでも使えるようになりました。',
    close: '閉じる',
  },
  settings: {
    title: '設定',
    unlockAll: 'すべてのレッスンを開く',
    unlockAllHint: '前のレベルを終えなくても、すべてのレベルをすぐに始められます。',
    home: 'ホーム',
  },
};
