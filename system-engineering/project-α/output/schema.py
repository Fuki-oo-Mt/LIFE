"""
Diana - JSON出力スキーマ

Pydanticモデルによる厳格なJSON出力バリデーション。
3Dエンジンへの制御信号として使用される。
"""

from typing import Literal

from pydantic import BaseModel, Field


class DianaResponse(BaseModel):
    """ディアナの応答を表すPydanticモデル。

    すべてのフィールドはJSON出力に必須で、
    Phase 4にて3Dエンジンの制御信号として使用される。
    """

    ui_visibility: Literal["show", "hide"] = Field(
        default="hide",
        description="3Dアバターの表示/非表示フラグ",
    )
    need_permission: bool = Field(
        default=False,
        description="インターネット検索の許可が必要かどうか",
    )
    emotion: Literal["happy", "thinking", "neutral", "apologetic", "surprised"] = Field(
        default="neutral",
        description="ディアナの感情状態",
    )
    action: Literal[
        "nodding", "looking_around", "typing", "smiling", "tilting_head"
    ] = Field(
        default="smiling",
        description="ディアナのアクション（Phase 4で3Dアニメーションに連動）",
    )
    text: str = Field(
        description="ユーザーへの応答テキスト",
    )
    internal_thought: str = Field(
        default="",
        description="AIの内部思考ログ",
    )
