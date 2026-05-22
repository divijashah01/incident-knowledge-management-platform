from django.urls import path
from .views import LoginView, LogoutView, RegisterView, MeView, UserListView, UserRoleView

urlpatterns = [
    path('login/',                  LoginView.as_view(),    name='login'),
    path('logout/',                 LogoutView.as_view(),   name='logout'),
    path('register/',               RegisterView.as_view(), name='register'),
    path('me/',                     MeView.as_view(),       name='me'),
    path('users/',                  UserListView.as_view(), name='user-list'),
    path('users/<int:user_id>/role/', UserRoleView.as_view(), name='user-role'),
]