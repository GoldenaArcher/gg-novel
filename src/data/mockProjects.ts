import { Project } from '../shared/types'

export const mockProjects: Project[] = [
  {
    id: 'p1',
    title: '雾城遗事',
    stats: {
      words: 29430,
      characters: 6
    },
    chapters: [
      {
        id: 'c1',
        title: '第一章 · 雾城醒来',
        words: 3265,
        status: 'draft',
        pace: 'slow burn',
        mood: '迷雾与希望',
        draft:
          '晨雾像旧日记里抹不去的字迹，沿着城墙缓缓滑落。顾言在钟声里醒来，第一次觉得这座城会改变他的一生……',
        summary: '主角醒来，城市氛围、内心重量、初步冲突全部抛出，为后续的任务埋下伏笔。'
      },
      {
        id: 'c2',
        title: '第二章 · 雨夜来客',
        words: 2811,
        status: 'outline',
        pace: 'balanced',
        mood: '压迫与张力',
        draft:
          '雨夜里敲门声显得有些缥缈，门外的访客穿着沾满泥水的长靴。他递来的情报，像碎裂的星图，指向失踪的真相。',
        summary: '访客带来任务，揭开新的谜团，并让主角站到选择的岔路上。'
      },
      {
        id: 'c3',
        title: '第三章 · 河面之光',
        words: 1904,
        status: 'draft',
        pace: 'fast',
        mood: '紧张与微光',
        draft:
          '河道的灯在暴雨间忽明忽暗，船只像被无形的手逼进狭窄的水道。顾言握紧怀表，等着那束约定的光出现。',
        summary: '行动戏，描写水上追逐，展现主角的决心和队友之间的默契。'
      }
    ],
    notes: [
      { id: 'n1', title: '灵感片段', content: '把雨夜访客的身份改成曾经的盟友，带来更复杂的情感冲突。' },
      { id: 'n2', title: '写作任务', content: '补完第二章尾声的悬念段落，埋下第三章冲突的伏笔。' }
    ],
    progress: {
      overall: 62,
      checkpoints: [
        { id: 'pg1', label: '世界观设定', value: '完成' },
        { id: 'pg2', label: '角色线重写', value: '进行中' },
        { id: 'pg3', label: '第四章草稿', value: '待开始' }
      ]
    }
  },
  {
    id: 'p2',
    title: '群星之下',
    stats: {
      words: 18200,
      characters: 4
    },
    chapters: [
      {
        id: 'c4',
        title: '序章 · 坠落',
        words: 2100,
        status: 'final',
        pace: 'fast',
        mood: '危机与冲突',
        draft: '星舰的船体在大气层内呻吟，庇护舱里的孩子们第一次看见真实的天穹。',
        summary: '主角们在坠毁中幸存，为逃离殖民地的控制埋下伏笔。'
      },
      {
        id: 'c5',
        title: '第一章 · 暗线',
        words: 3890,
        status: 'draft',
        pace: 'balanced',
        mood: '潜伏与紧张',
        draft: '黎落潜入计划室，偷走了舰队部署表，她知道这会把整个团队拖入深渊。',
        summary: '展开潜伏行动，揭示背后的阴谋。'
      }
    ],
    notes: [
      { id: 'n3', title: '世界观答案', content: '加深对星港与地下联盟关系的描写，加一点政治讽刺。' },
      { id: 'n4', title: '情绪基调', content: '第二部分以希望开篇，避免持续压抑带来的疲惫感。' }
    ],
    progress: {
      overall: 38,
      checkpoints: [
        { id: 'pg4', label: '故事线勾勒', value: '完成' },
        { id: 'pg5', label: '感情线细化', value: '待开始' },
        { id: 'pg6', label: '终章草稿', value: '待开始' }
      ]
    }
  }
]
