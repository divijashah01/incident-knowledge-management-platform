from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from .models import UserProfile


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get('username', '').strip()
        password = request.data.get('password', '').strip()

        if not username or not password:
            return Response(
                {"error": "Username and password are required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        user = authenticate(request, username=username, password=password)
        if not user:
            return Response(
                {"error": "Invalid username or password."},
                status=status.HTTP_401_UNAUTHORIZED
            )

        login(request, user)

        # Get or create profile (handles existing Django users with no profile)
        profile, _ = UserProfile.objects.get_or_create(
            user=user, defaults={'role': 'reporter'})

        return Response({
            "message":  "Logged in successfully.",
            "user": {
                "id":       user.id,
                "username": user.username,
                "email":    user.email,
                "role":     profile.role,
            }
        }, status=status.HTTP_200_OK)


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        logout(request)
        return Response({"message": "Logged out successfully."}, status=status.HTTP_200_OK)


class RegisterView(APIView):
    """
    Public registration — always creates a Reporter role.
    Engineers and Admins are created by an existing Admin via /api/auth/users/.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        username  = request.data.get('username',  '').strip()
        password  = request.data.get('password',  '').strip()
        email     = request.data.get('email',     '').strip()
        full_name = request.data.get('full_name', '').strip()

        if not username or not password:
            return Response(
                {"error": "Username and password are required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if User.objects.filter(username=username).exists():
            return Response(
                {"error": "Username already taken."},
                status=status.HTTP_409_CONFLICT
            )

        if len(password) < 8:
            return Response(
                {"error": "Password must be at least 8 characters."},
                status=status.HTTP_400_BAD_REQUEST
            )

        first_name, last_name = '', ''
        if full_name:
            parts      = full_name.split(' ', 1)
            first_name = parts[0]
            last_name  = parts[1] if len(parts) > 1 else ''

        user = User.objects.create_user(
            username=username, password=password,
            email=email, first_name=first_name, last_name=last_name
        )
        UserProfile.objects.create(user=user, role='reporter')
        login(request, user)

        return Response({
            "message": "Account created successfully.",
            "user": {
                "id":       user.id,
                "username": user.username,
                "email":    user.email,
                "role":     "reporter",
            }
        }, status=status.HTTP_201_CREATED)


class MeView(APIView):
    """
    GET /api/auth/me/
    Returns the currently authenticated user's info and role.
    Frontend calls this on app load to restore auth state.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user    = request.user
        profile, _ = UserProfile.objects.get_or_create(
            user=user, defaults={'role': 'reporter'})
        return Response({
            "id":       user.id,
            "username": user.username,
            "email":    user.email,
            "role":     profile.role,
        }, status=status.HTTP_200_OK)


class UserListView(APIView):
    """
    GET  /api/auth/users/   — Admin: list all users
    POST /api/auth/users/   — Admin: create Engineer or Admin user
    """
    permission_classes = [IsAuthenticated]

    def _is_admin(self, request):
        try:
            return request.user.profile.role == 'admin'
        except UserProfile.DoesNotExist:
            return False

    def get(self, request):
        if not self._is_admin(request):
            return Response({"error": "Admin access required."}, status=status.HTTP_403_FORBIDDEN)

        users = User.objects.select_related('profile').all().order_by('date_joined')
        result = []
        for u in users:
            # CORRECT
            profile, _ = UserProfile.objects.get_or_create(user=u, defaults={'role': 'reporter'})
            result.append({
                "id":          u.id,
                "username":    u.username,
                "email":       u.email,
                "role":        profile.role,
                "date_joined": u.date_joined,
                "is_active":   u.is_active,
            })
        return Response({"users": result}, status=status.HTTP_200_OK)

    def post(self, request):
        if not self._is_admin(request):
            return Response({"error": "Admin access required."}, status=status.HTTP_403_FORBIDDEN)

        username  = request.data.get('username', '').strip()
        password  = request.data.get('password', '').strip()
        email     = request.data.get('email',    '').strip()
        role      = request.data.get('role',     'engineer')

        if role not in ['reporter', 'engineer', 'admin']:
            return Response({"error": "Invalid role."}, status=status.HTTP_400_BAD_REQUEST)

        if not username or not password:
            return Response({"error": "Username and password required."}, status=status.HTTP_400_BAD_REQUEST)

        if User.objects.filter(username=username).exists():
            return Response({"error": "Username already taken."}, status=status.HTTP_409_CONFLICT)

        user = User.objects.create_user(username=username, password=password, email=email)
        UserProfile.objects.create(user=user, role=role)

        return Response({
            "message":  f"User '{username}' created with role '{role}'.",
            "user": {"id": user.id, "username": username, "role": role}
        }, status=status.HTTP_201_CREATED)


class UserRoleView(APIView):
    """
    PATCH /api/auth/users/<user_id>/role/
    Admin: change a user's role.
    """
    permission_classes = [IsAuthenticated]

    def patch(self, request, user_id):
        try:
            profile = request.user.profile
        except UserProfile.DoesNotExist:
            return Response({"error": "Admin access required."}, status=status.HTTP_403_FORBIDDEN)

        if profile.role != 'admin':
            return Response({"error": "Admin access required."}, status=status.HTTP_403_FORBIDDEN)

        new_role = request.data.get('role', '').strip()
        if new_role not in ['reporter', 'engineer', 'admin']:
            return Response({"error": "Invalid role."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            target_user    = User.objects.get(id=user_id)
            target_profile, _ = UserProfile.objects.get_or_create(
                user=target_user, defaults={'role': 'reporter'})
            target_profile.role = new_role
            target_profile.save()
            return Response({
                "message":  f"{target_user.username} role updated to '{new_role}'.",
                "user_id":  user_id,
                "new_role": new_role,
            }, status=status.HTTP_200_OK)
        except User.DoesNotExist:
            return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)