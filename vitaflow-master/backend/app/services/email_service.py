from __future__ import annotations

import smtplib
from datetime import datetime, timezone
from email.message import EmailMessage
from email.utils import format_datetime, formataddr, make_msgid
from html import escape
from typing import Any

from app.core.config import settings
from app.core.exceptions import AppException


def _send_message(message: EmailMessage, fail_message: str) -> None:
    if not settings.smtp_host or not settings.smtp_from_email:
        raise AppException("邮件服务尚未配置，请联系管理员")
    try:
        smtp_class = smtplib.SMTP_SSL if settings.smtp_use_ssl else smtplib.SMTP
        with smtp_class(settings.smtp_host, settings.smtp_port, timeout=settings.smtp_timeout) as server:
            if not settings.smtp_use_ssl and settings.smtp_use_tls:
                server.starttls()
            if settings.smtp_username:
                server.login(settings.smtp_username, settings.smtp_password)
            server.send_message(message)
    except (OSError, smtplib.SMTPException) as exc:
        raise AppException(fail_message) from exc


def send_registration_code(email: str, code: str) -> None:
    message = EmailMessage()
    message["Subject"] = f"{settings.smtp_from_name} 注册验证码"
    message["From"] = formataddr((settings.smtp_from_name, settings.smtp_from_email))
    message["To"] = email
    message["Date"] = format_datetime(datetime.now(timezone.utc))
    message["Message-ID"] = make_msgid(domain=settings.smtp_from_email.partition("@")[2] or None)
    message.set_content(
        f"你的注册验证码是：{code}\n\n"
        f"验证码在 {settings.email_code_expire_minutes} 分钟内有效。如非本人操作，请忽略此邮件。"
    )

    html_content = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 40px auto; padding: 40px; border-radius: 16px; background-color: #ffffff; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.04); border: 1px solid #f3f4f6;">
        <div style="text-align: center; margin-bottom: 32px;">
            <h2 style="color: #111827; font-size: 24px; font-weight: 600; margin: 0; letter-spacing: -0.025em;">验证您的邮箱</h2>
        </div>
        <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0; text-align: center;">
            欢迎使用 <strong>{settings.smtp_from_name}</strong>。请使用以下验证码完成验证：
        </p>
        <div style="text-align: center; margin-bottom: 32px;">
            <div style="display: inline-block; background-color: #f9fafb; color: #111827; font-size: 32px; font-weight: 700; letter-spacing: 0.25em; padding: 16px 32px; border-radius: 12px; border: 1px solid #e5e7eb; box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);">
                {code}
            </div>
        </div>
        <div style="border-top: 1px solid #f3f4f6; padding-top: 24px; text-align: center;">
            <p style="color: #9ca3af; font-size: 13px; line-height: 1.5; margin: 0;">
                验证码在 <strong>{settings.email_code_expire_minutes} 分钟</strong> 内有效。<br>
                如非本人操作，请忽略此邮件。
            </p>
        </div>
    </div>
    <div style="text-align: center; margin-top: 24px;">
        <p style="color: #d1d5db; font-size: 12px; margin: 0;">&copy; {settings.smtp_from_name}. All rights reserved.</p>
    </div>
    """
    message.add_alternative(html_content, subtype='html')
    _send_message(message, "验证码发送失败，请稍后重试")


def send_password_reset_code(email: str, code: str) -> None:
    message = EmailMessage()
    message["Subject"] = f"{settings.smtp_from_name} 找回密码验证码"
    message["From"] = formataddr((settings.smtp_from_name, settings.smtp_from_email))
    message["To"] = email
    message["Date"] = format_datetime(datetime.now(timezone.utc))
    message["Message-ID"] = make_msgid(domain=settings.smtp_from_email.partition("@")[2] or None)
    message.set_content(
        f"你的找回密码验证码是：{code}\n\n"
        f"验证码在 {settings.email_code_expire_minutes} 分钟内有效。如非本人操作，请忽略此邮件。"
    )

    html_content = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 40px auto; padding: 40px; border-radius: 16px; background-color: #ffffff; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.04); border: 1px solid #f3f4f6;">
        <div style="text-align: center; margin-bottom: 32px;">
            <h2 style="color: #111827; font-size: 24px; font-weight: 600; margin: 0; letter-spacing: -0.025em;">重置您的密码</h2>
        </div>
        <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0; text-align: center;">
            您正在通过 <strong>{settings.smtp_from_name}</strong> 找回密码。请使用以下验证码完成验证：
        </p>
        <div style="text-align: center; margin-bottom: 32px;">
            <div style="display: inline-block; background-color: #f9fafb; color: #111827; font-size: 32px; font-weight: 700; letter-spacing: 0.25em; padding: 16px 32px; border-radius: 12px; border: 1px solid #e5e7eb; box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);">
                {code}
            </div>
        </div>
        <div style="border-top: 1px solid #f3f4f6; padding-top: 24px; text-align: center;">
            <p style="color: #9ca3af; font-size: 13px; line-height: 1.5; margin: 0;">
                验证码在 <strong>{settings.email_code_expire_minutes} 分钟</strong> 内有效。<br>
                如非本人操作，请忽略此邮件。
            </p>
        </div>
    </div>
    <div style="text-align: center; margin-top: 24px;">
        <p style="color: #d1d5db; font-size: 12px; margin: 0;">&copy; {settings.smtp_from_name}. All rights reserved.</p>
    </div>
    """
    message.add_alternative(html_content, subtype="html")
    _send_message(message, "验证码发送失败，请稍后重试")


def send_feedback_notification(to_email: str, feedback: Any, user: Any) -> None:
    message = EmailMessage()
    message["Subject"] = f"{settings.smtp_from_name} 新用户反馈"
    message["From"] = formataddr((settings.smtp_from_name, settings.smtp_from_email))
    message["To"] = to_email
    message["Date"] = format_datetime(datetime.now(timezone.utc))
    message["Message-ID"] = make_msgid(domain=settings.smtp_from_email.partition("@")[2] or None)

    username = getattr(user, "username", "") or "-"
    user_email = getattr(user, "email", "") or "-"
    content = getattr(feedback, "content", "") or ""
    category = getattr(feedback, "category", "") or "general"
    contact = getattr(feedback, "contact", "") or "-"
    created_at = getattr(feedback, "create_time", None) or datetime.now()
    text_content = (
        f"收到新的用户反馈\n\n"
        f"用户：{username}（{user_email}）\n"
        f"分类：{category}\n"
        f"联系方式：{contact}\n"
        f"时间：{created_at}\n\n"
        f"反馈内容：\n{content}"
    )
    message.set_content(text_content)
    html_display_content = content.replace("<img ", '<img style="max-width: 100%; max-height: 280px; width: auto; height: auto; border-radius: 8px; display: block; margin: 12px 0; object-fit: contain;" ')
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            img {{ max-width: 100% !important; max-height: 280px !important; height: auto !important; width: auto !important; border-radius: 8px !important; display: block !important; margin: 12px 0 !important; object-fit: contain !important; }}
        </style>
    </head>
    <body>
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 640px; margin: 32px auto; padding: 28px; border: 1px solid #e5e7eb; border-radius: 16px; background: #fff;">
            <h2 style="margin: 0 0 16px; color: #111827;">新的用户反馈</h2>
            <p style="margin: 0 0 8px; color: #4b5563;"><strong>用户：</strong>{escape(username)}（{escape(user_email)}）</p>
            <p style="margin: 0 0 8px; color: #4b5563;"><strong>分类：</strong>{escape(category)}</p>
            <p style="margin: 0 0 8px; color: #4b5563;"><strong>联系方式：</strong>{escape(contact)}</p>
            <p style="margin: 0 0 18px; color: #4b5563;"><strong>时间：</strong>{escape(str(created_at))}</p>
            <div style="line-height: 1.7; color: #111827; background: #f9fafb; border-radius: 12px; padding: 16px; overflow-x: auto;">{html_display_content}</div>
        </div>
    </body>
    </html>
    """
    message.add_alternative(html_content, subtype="html")
    _send_message(message, "反馈通知邮件发送失败")


def send_feedback_result_email(to_email: str, feedback: Any, user: Any) -> None:
    message = EmailMessage()
    message["Subject"] = f"{settings.smtp_from_name} 反馈处理结果"
    message["From"] = formataddr((settings.smtp_from_name, settings.smtp_from_email))
    message["To"] = to_email
    message["Date"] = format_datetime(datetime.now(timezone.utc))
    message["Message-ID"] = make_msgid(domain=settings.smtp_from_email.partition("@")[2] or None)

    username = getattr(user, "username", "") or "用户"
    category = getattr(feedback, "category", "") or "意见反馈"
    status = getattr(feedback, "status", "") or "-"
    reply = getattr(feedback, "admin_reply", "") or ""
    created_at = getattr(feedback, "create_time", None) or "-"
    status_text = {
        "open": "待处理",
        "processing": "处理中",
        "resolved": "已解决",
        "closed": "已关闭",
    }.get(status, status)

    message.set_content(
        f"{username}，您好：\n\n"
        f"您提交的反馈已有处理结果。\n\n"
        f"反馈模块：{category}\n"
        f"当前状态：{status_text}\n"
        f"提交时间：{created_at}\n\n"
        f"处理结果：\n{reply}\n\n"
        f"感谢您的反馈。"
    )
    html_reply = escape(reply).replace("\n", "<br>")
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <body>
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 640px; margin: 32px auto; padding: 28px; border: 1px solid #e5e7eb; border-radius: 16px; background: #fff;">
            <h2 style="margin: 0 0 16px; color: #111827;">反馈处理结果</h2>
            <p style="margin: 0 0 16px; color: #4b5563;">{escape(username)}，您好，您提交的反馈已有处理结果。</p>
            <div style="margin-bottom: 18px; color: #4b5563; line-height: 1.7;">
                <div><strong>反馈模块：</strong>{escape(category)}</div>
                <div><strong>当前状态：</strong>{escape(status_text)}</div>
                <div><strong>提交时间：</strong>{escape(str(created_at))}</div>
            </div>
            <div style="border-radius: 12px; background: #ecfdf5; border: 1px solid #d1fae5; padding: 16px; line-height: 1.7; color: #064e3b;">
                <div style="font-weight: 600; margin-bottom: 8px;">处理结果</div>
                <div>{html_reply}</div>
            </div>
            <p style="margin: 18px 0 0; color: #9ca3af; font-size: 13px;">感谢您的反馈。</p>
        </div>
    </body>
    </html>
    """
    message.add_alternative(html_content, subtype="html")
    _send_message(message, "反馈处理结果邮件发送失败")
