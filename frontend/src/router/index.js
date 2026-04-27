import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import ImportView from '@/views/ImportView.vue'
import LibraryView from '@/views/LibraryView.vue'
import DictationView from '@/views/DictationView.vue'
import BooksView from '@/views/BooksView.vue'
import WrongWordsView from '@/views/WrongWordsView.vue'
import LearningReportView from '@/views/LearningReportView.vue'

const routes = [
  {
    path: '/',
    name: 'home',
    component: HomeView,
    meta: {
      title: '首页'
    }
  },
  {
    path: '/import',
    name: 'import',
    component: ImportView,
    meta: {
      title: '导入'
    }
  },
  {
    path: '/library',
    name: 'library',
    component: LibraryView,
    meta: {
      title: '词库'
    }
  },
  {
    path: '/books',
    name: 'books',
    component: BooksView,
    meta: {
      title: '词书'
    }
  },
  {
    path: '/wrong-words',
    name: 'wrong-words',
    component: WrongWordsView,
    meta: {
      title: '错词本'
    }
  },
  {
    path: '/report',
    name: 'learning-report',
    component: LearningReportView,
    meta: {
      title: '学习报告'
    }
  },
  {
    path: '/dictation',
    name: 'dictation',
    component: DictationView,
    meta: {
      title: '听写'
    }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 }
  }
})

router.afterEach((to) => {
  document.title = `HearWords | ${to.meta.title || '前端壳层'}`
})

export default router
