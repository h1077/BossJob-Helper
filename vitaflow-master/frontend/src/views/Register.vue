<script setup lang="ts">
import { ref } from "vue"
import { useRouter, RouterLink } from "vue-router"
import { registerApi } from "@/api/auth"
import Button from "@/components/ui/button/Button.vue"
import Input from "@/components/ui/input/Input.vue"
import Label from "@/components/ui/label/Label.vue"
import BrandLogo from "@/components/common/BrandLogo.vue"

const router = useRouter()
const form = ref({ username: "", email: "", password: "", verification_code: "" })
const error = ref("")
async function submit() {
  try {
    await registerApi(form.value)
    router.push("/login")
  } catch (e: any) {
    error.value = e.message
  }
}
</script>
<template>
  <div class="flex min-h-screen items-center justify-center bg-[#f7f8fb] px-6">
    <div class="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
      <RouterLink to="/" class="inline-flex rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
        <BrandLogo />
      </RouterLink>
      <h1 class="mt-8 text-2xl font-semibold">创建账号</h1>
      <div class="mt-6 space-y-4">
        <div><Label>用户名</Label><Input v-model="form.username" /></div>
        <div><Label>邮箱</Label><Input v-model="form.email" /></div>
        <div><Label>密码</Label><Input v-model="form.password" type="password" /></div>
        <div><Label>邮箱验证码</Label><Input v-model="form.verification_code" inputmode="numeric" maxlength="6" /></div>
        <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
        <Button class="w-full" @click="submit">注册</Button>
        <RouterLink class="block text-center text-sm text-gray-500 hover:text-gray-900" to="/login">已有账号？去登录</RouterLink>
      </div>
    </div>
  </div>
</template>
