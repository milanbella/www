module Ionic exposing (ion_button, ion_icon)

import Html exposing (Attribute, Html, node)


ion_button : List (Attribute msg) -> List (Html msg) -> Html msg
ion_button attributes children =
    node "ion-button" attributes children


ion_icon : List (Attribute msg) -> List (Html msg) -> Html msg
ion_icon attributes children =
    node "ion-icon" attributes children
