import { useLocation, useNavigate } from "react-router-dom";

export default function SignupCompletePage() {
    const nav = useNavigate();
    const location = useLocation();
    const { userId, nickname } = location.state || { userId: '사용자', nickname: '알 수 없음' };

    return (
        <div style={{ textAlign: 'center', marginTop: '50px' }}>
            <h2>회원가입 완료</h2>
            <p>{nickname}({userId})님, 회원 가입이 완료되었습니다.</p>
            <button onClick={() => nav('/login')}>로그인 페이지로 이동하기</button>
        </div>
    );
}