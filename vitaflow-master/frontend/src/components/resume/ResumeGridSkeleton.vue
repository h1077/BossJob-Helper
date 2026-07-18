<template>
  <div class="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
    <div v-for="item in 10" :key="item" class="rounded-[1.5rem] bg-white p-2 shadow-sm ring-1 ring-zinc-100 sm:rounded-[2rem] sm:p-2.5">
      <div class="aspect-[1/1.1] animate-pulse rounded-[1.25rem] bg-zinc-100 sm:rounded-[1.5rem]"></div>
      <div class="mb-2 mt-4 px-2 sm:mt-5 sm:px-3">
        <div class="mb-3 flex items-center justify-between gap-2">
          <div class="h-4 w-1/2 animate-pulse rounded bg-zinc-100"></div>
          <div class="h-4 w-12 animate-pulse rounded-full bg-zinc-100 sm:w-16"></div>
        </div>
        <div class="h-3 w-1/3 animate-pulse rounded bg-zinc-100"></div>
      </div>
    </div>
  </div>
</template>
