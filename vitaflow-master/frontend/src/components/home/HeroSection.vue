<script setup lang="ts">
import { RouterLink } from "vue-router"
import { ArrowRight } from "lucide-vue-next"
import { ref } from "vue"

const resumeCardRef = ref<HTMLElement | null>(null)
const mousePos = ref({ x: -1000, y: -1000 })
const isHovering = ref(false)

const handleMouseMove = (e: MouseEvent) => {
  if (!resumeCardRef.value) return
  const rect = resumeCardRef.value.getBoundingClientRect()
  mousePos.value = {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  }
}
</script>

<template>
  <section class="relative overflow-hidden bg-[#fafafa] px-4 sm:px-6 py-8 sm:py-20 min-h-[calc(100vh-4rem)] flex items-center">
    <div class="mx-auto w-full max-w-7xl">
      <!-- Desktop Layout -->
      <div class="hidden lg:grid lg:grid-cols-2 gap-12 items-center">
        <!-- Text Content -->
        <div class="max-w-2xl animate-fade-in-up">
          <h1 class="text-5xl lg:text-7xl font-medium tracking-tight text-zinc-900 leading-[1.1]">
            你的经历，<br />值得更好的表达。
          </h1>
          <p class="mt-6 text-xl text-zinc-500 leading-relaxed max-w-xl">
            用极简的方式打造专业简历。AI 帮你提炼亮点，一键生成清晰优雅的 PDF 排版。
          </p>
          <div class="mt-10 flex gap-4 items-center">
            <RouterLink to="/resumes" class="inline-flex h-12 items-center justify-center rounded-full bg-zinc-900 px-8 text-sm font-medium text-white transition-transform hover:scale-105 hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 !text-white">
              开始创建 <ArrowRight class="ml-2 h-4 w-4 text-white" />
            </RouterLink>
            <RouterLink to="/templates" class="inline-flex h-12 items-center justify-center rounded-full border border-zinc-200 bg-white px-8 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-200 focus:ring-offset-2">
              查看模板
            </RouterLink>
          </div>
        </div>
        
        <!-- Big Resume Display -->
        <div class="relative mx-auto w-full lg:max-w-[380px] perspective-1000">
          
          <!-- Ambient Background Glow -->
          <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-gradient-to-tr from-zinc-200 via-zinc-100 to-zinc-300 rounded-full blur-3xl opacity-70 pointer-events-none"></div>

          <!-- Background Card 2 (Bottom layer) -->
          <div class="absolute inset-0 aspect-[210/297] w-full rounded-md bg-white/40 shadow-sm border border-white/50 backdrop-blur-sm" style="transform: rotateY(-12deg) rotateX(2deg) translateZ(-80px) translateX(40px) translateY(20px);"></div>
          
          <!-- Background Card 1 (Middle layer) -->
          <div class="absolute inset-0 aspect-[210/297] w-full rounded-md bg-white/60 shadow-md border border-white/70 backdrop-blur-md" style="transform: rotateY(-10deg) rotateX(3deg) translateZ(-40px) translateX(20px) translateY(10px);"></div>

          <!-- Main Resume Card -->
          <div 
            ref="resumeCardRef"
            @mousemove="handleMouseMove"
            @mouseenter="isHovering = true"
            @mouseleave="isHovering = false"
            class="resume-card group relative aspect-[210/297] w-full rounded-md bg-white shadow-[0_20px_50px_rgba(0,0,0,0.1)] transition-all duration-1000 ease-out border border-zinc-100 z-10 overflow-hidden cursor-crosshair"
          >
            <!-- Base Mockup Layer -->
            <div class="absolute inset-0 p-10 pointer-events-none">
              <!-- decorative header -->
            <div class="border-b border-zinc-200 pb-6 mb-6">
              <div class="h-8 w-1/3 rounded-sm bg-zinc-800"></div>
              <div class="mt-4 flex gap-4">
                <div class="h-3 w-24 rounded-sm bg-zinc-200"></div>
                <div class="h-3 w-32 rounded-sm bg-zinc-200"></div>
              </div>
            </div>
            
            <div class="space-y-8">
              <!-- section -->
              <div>
                <div class="h-4 w-20 rounded-sm bg-zinc-900 mb-4"></div>
                <div class="space-y-3">
                  <div class="h-3 w-full rounded-sm bg-zinc-100"></div>
                  <div class="h-3 w-5/6 rounded-sm bg-zinc-100"></div>
                  <div class="h-3 w-4/6 rounded-sm bg-zinc-100"></div>
                </div>
              </div>
              <!-- section -->
              <div>
                <div class="h-4 w-24 rounded-sm bg-zinc-900 mb-4"></div>
                <div class="space-y-6">
                  <div>
                    <div class="flex justify-between mb-3">
                      <div class="h-3 w-1/3 rounded-sm bg-zinc-300"></div>
                      <div class="h-3 w-16 rounded-sm bg-zinc-200"></div>
                    </div>
                    <div class="space-y-2">
                      <div class="h-2 w-full rounded-sm bg-zinc-100"></div>
                      <div class="h-2 w-full rounded-sm bg-zinc-100"></div>
                      <div class="h-2 w-3/4 rounded-sm bg-zinc-100"></div>
                    </div>
                  </div>
                  <div>
                    <div class="flex justify-between mb-3">
                      <div class="h-3 w-2/5 rounded-sm bg-zinc-300"></div>
                      <div class="h-3 w-16 rounded-sm bg-zinc-200"></div>
                    </div>
                    <div class="space-y-2">
                      <div class="h-2 w-full rounded-sm bg-zinc-100"></div>
                      <div class="h-2 w-4/5 rounded-sm bg-zinc-100"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            </div>
            
            <!-- Interaction Hint -->
            <div 
              class="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 transition-all duration-500 pointer-events-none flex flex-col items-center gap-1.5"
              :class="isHovering ? 'opacity-0 translate-y-2' : 'opacity-40'"
            >
              <span class="text-[9px] font-mono tracking-[0.4em] text-zinc-900 uppercase font-bold ml-[0.4em]">Hover</span>
            </div>
            
            <!-- Spotlight/Reveal Layer (Real Resume) -->
            <div 
              class="absolute inset-0 bg-white z-20 pointer-events-none transition-opacity duration-300"
              :style="{
                clipPath: `circle(90px at ${mousePos.x}px ${mousePos.y}px)`,
                opacity: isHovering ? 1 : 0
              }"
            >
              <div class="p-8 h-full w-full">
                <div class="border-b-2 border-zinc-900 pb-2.5 mb-2.5">
                  <h1 class="text-3xl font-bold text-zinc-900 tracking-tight">Elliot</h1>
                  <div class="text-zinc-600 text-[10px] mt-1 flex gap-2">
                    <span>18800000000</span>
                    <span>|</span>
                    <span>admin@cgz233.cn</span>
                    <span>|</span>
                    <span>AI Agent 研发工程师</span>
                  </div>
                </div>
                <div class="space-y-3.5">
                  <section>
                    <h2 class="text-xs font-bold text-zinc-900 mb-1.5 border-b border-zinc-200 pb-0.5">教育经历</h2>
                    <div class="flex justify-between text-[9px] font-bold text-zinc-800 mt-1">
                      <span>X 科技大学 - 人工智能 (本科)</span>
                      <span>2020.09 - 2024.06</span>
                    </div>
                  </section>
                  <section>
                    <h2 class="text-xs font-bold text-zinc-900 mb-1.5 border-b border-zinc-200 pb-0.5">专业技能</h2>
                    <ul class="list-disc list-inside text-[9px] text-zinc-700 space-y-0.5">
                      <li>精通 Prompt Engineering，熟练掌握 LangChain、LlamaIndex 等 Agent 开发框架。</li>
                      <li>熟悉 ReAct 等大模型规划机制，具备多智能体（Multi-Agent）协同架构设计经验。</li>
                      <li>掌握 RAG 系统架构原理，熟练使用 Milvus、Pinecone 等向量数据库进行语义检索优化。</li>
                    </ul>
                  </section>
                  <section>
                    <h2 class="text-xs font-bold text-zinc-900 mb-1.5 border-b border-zinc-200 pb-0.5">工作与项目经历</h2>
                    <div class="mb-2">
                      <div class="flex justify-between text-[9px] font-bold text-zinc-800">
                        <span>零度极客科技 - Agent 研发工程师</span>
                        <span>2024.09 - 2025.03</span>
                      </div>
                      <ul class="list-disc list-inside text-[9px] text-zinc-700 mt-0.5 space-y-0.5">
                        <li>负责核心业务的智能体工作流设计，构建基于大语言模型驱动的自动化办公 Agent。</li>
                        <li>主导研发 Multi-Agent 协作框架，支持多角色智能体并行处理复杂任务，整体效率提升 100%。</li>
                        <li>设计并实现基于 RAG 的企业私有知识库问答系统，将长文本检索准确率提升 35%。</li>
                      </ul>
                    </div>
                    <div>
                      <div class="flex justify-between text-[9px] font-bold text-zinc-800">
                        <span>某互联网大厂 - 算法工程实习生</span>
                        <span>2024.03 - 2024.08</span>
                      </div>
                      <ul class="list-disc list-inside text-[9px] text-zinc-700 mt-0.5 space-y-0.5">
                        <li>协助完成大模型微调（Fine-tuning）的高质量数据集清洗、格式化与构建工作。</li>
                        <li>开发自动化 Prompt 评估体系，通过量化指标大幅缩短模型迭代的验证周期。</li>
                      </ul>
                    </div>
                  </section>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Typographic AI Label -->
          <div class="absolute -top-6 -right-6 animate-fade-in-up z-20 float-anim delay-200">
            <div class="rounded bg-zinc-900 px-4 py-2 shadow-xl border border-zinc-800 flex items-center justify-center">
              <span class="text-[10px] font-mono tracking-[0.25em] text-zinc-100 uppercase font-bold">AI-Powered</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Mobile / Tablet Dedicated Immersive Layout -->
      <div class="lg:hidden w-full relative py-12">
        <div class="relative mx-auto w-full max-w-[320px] sm:max-w-[380px] perspective-1000 -translate-x-3 sm:-translate-x-4">
          
          <!-- Ambient Background Glow -->
          <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[115%] h-[115%] bg-gradient-to-tr from-zinc-200 via-zinc-100 to-zinc-300 rounded-full blur-2xl opacity-70 pointer-events-none"></div>

          <!-- Background Card 2 (Bottom layer) -->
          <div class="absolute inset-0 aspect-[210/297] w-full rounded-2xl bg-white/40 shadow-sm border border-white/50 backdrop-blur-sm" style="transform: rotateY(-12deg) rotateX(2deg) translateZ(-80px) translateX(25px) translateY(15px);"></div>
          
          <!-- Background Card 1 (Middle layer) -->
          <div class="absolute inset-0 aspect-[210/297] w-full rounded-2xl bg-white/60 shadow-md border border-white/70 backdrop-blur-md" style="transform: rotateY(-10deg) rotateX(3deg) translateZ(-40px) translateX(12px) translateY(8px);"></div>

          <!-- Main Resume Card Backdrop (PC style mockup) -->
          <div class="resume-card relative aspect-[210/297] w-full rounded-2xl bg-white shadow-[0_20px_50px_rgba(0,0,0,0.1)] border border-zinc-100 overflow-hidden z-10">
            <!-- Base Mockup Layer -->
            <div class="absolute inset-0 p-6 sm:p-8 pointer-events-none opacity-40">
              <!-- decorative header -->
              <div class="border-b border-zinc-200 pb-5 mb-5">
                <div class="h-6 w-1/3 rounded-sm bg-zinc-800"></div>
                <div class="mt-3 flex gap-3">
                  <div class="h-2 w-20 rounded-sm bg-zinc-200"></div>
                  <div class="h-2 w-28 rounded-sm bg-zinc-200"></div>
                </div>
              </div>
              
              <div class="space-y-6">
                <div>
                  <div class="h-3 w-16 rounded-sm bg-zinc-900 mb-3"></div>
                  <div class="space-y-2">
                    <div class="h-2 w-full rounded-sm bg-zinc-100"></div>
                    <div class="h-2 w-5/6 rounded-sm bg-zinc-100"></div>
                    <div class="h-2 w-4/6 rounded-sm bg-zinc-100"></div>
                  </div>
                </div>
                <div>
                  <div class="h-3 w-20 rounded-sm bg-zinc-900 mb-3"></div>
                  <div class="space-y-4">
                    <div>
                      <div class="flex justify-between mb-2">
                        <div class="h-2 w-1/3 rounded-sm bg-zinc-300"></div>
                        <div class="h-2 w-12 rounded-sm bg-zinc-200"></div>
                      </div>
                      <div class="space-y-1.5">
                        <div class="h-1.5 w-full rounded-sm bg-zinc-100"></div>
                        <div class="h-1.5 w-full rounded-sm bg-zinc-100"></div>
                        <div class="h-1.5 w-3/4 rounded-sm bg-zinc-100"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Crisp Elegant Glassmorphic Content Card (Seamless overlay) -->
            <div class="absolute inset-0 z-20 flex flex-col justify-center items-center p-6 text-center bg-white/80 backdrop-blur-[6px]">
              <!-- AI Badge -->
              <div class="mb-5 rounded-full bg-zinc-100 px-3.5 py-1 border border-zinc-200 flex items-center justify-center animate-fade-in-up">
                <span class="text-[10px] font-mono tracking-[0.2em] text-zinc-600 uppercase font-bold">AI-Powered</span>
              </div>

              <!-- Main Titles -->
              <h1 class="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900 leading-[1.2] mb-3 animate-fade-in-up">
                你的经历，<br />值得更好的表达。
              </h1>
              
              <p class="text-xs sm:text-sm text-zinc-500 leading-relaxed mb-8 font-normal max-w-[250px] sm:max-w-xs animate-fade-in-up">
                用极简的方式打造专业简历。AI 帮你提炼亮点，一键生成清晰优雅的 PDF 排版。
              </p>

              <!-- Call to Actions -->
              <div class="flex flex-col w-full gap-3 max-w-[220px] animate-fade-in-up">
                <RouterLink to="/resumes" class="w-full inline-flex h-11 items-center justify-center rounded-full bg-zinc-900 px-6 text-xs font-medium text-white shadow-sm active:scale-95 transition-all !text-white">
                  开始创建 <ArrowRight class="ml-2 h-4 w-4 text-white" />
                </RouterLink>
                <RouterLink to="/templates" class="w-full inline-flex h-11 items-center justify-center rounded-full border border-zinc-200 bg-white px-6 text-xs font-medium text-zinc-900 shadow-sm active:scale-95 transition-all hover:bg-zinc-50">
                  查看模板
                </RouterLink>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.perspective-1000 {
  perspective: 1000px;
}
.resume-card {
  transform: rotateY(-8deg) rotateX(4deg) translateZ(0);
  animation: float 6s ease-in-out infinite;
}
.resume-card:hover {
  transform: rotateY(0deg) rotateX(0deg) translateZ(0);
}
@keyframes float {
  0% { transform: rotateY(-8deg) rotateX(4deg) translateY(0px); }
  50% { transform: rotateY(-8deg) rotateX(4deg) translateY(-15px); }
  100% { transform: rotateY(-8deg) rotateX(4deg) translateY(0px); }
}
.float-anim {
  animation: float-simple 5s ease-in-out infinite;
}
@keyframes float-simple {
  0% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
  100% { transform: translateY(0px); }
}
.animate-fade-in-up {
  opacity: 0;
  animation: fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
